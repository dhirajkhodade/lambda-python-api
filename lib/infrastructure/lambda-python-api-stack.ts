import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { aws_lambda as lambda, aws_ec2 as ec2, Duration, aws_apigateway } from 'aws-cdk-lib'
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway'
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'



export class LambdaPythonApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


// You can import existing VPC by providing vpc id here 
    const privateVpc = ec2.Vpc.fromLookup(this, `vpc`, {
      vpcId: "1234567890",
    })

    const lambdaSg = new ec2.SecurityGroup(this, 'lambda-sg', {
      vpc: privateVpc,
      allowAllOutbound: true,
      description: 'security group for API',
    })

    //Add your desired ip address for incomming trafic
    lambdaSg.addIngressRule(ec2.Peer.ipv4('1.2.3.4/8'), ec2.Port.tcp(443), 'allow https incoming trafic from specific network')


    const lambdaLayerAutomationLambdaRole = new Role(this, 'python-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    })

    lambdaLayerAutomationLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ['*'],
        actions: [
          'ssm:GetParameter',
        ],
      }),
    )


    const fnEndpoint = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'controller',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda-handler')),
    });

    fnEndpoint.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'))

    const interfaceVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, `vpc-endpoint`, {
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      vpc: privateVpc,
      subnets: {
        subnetFilters : [ec2.SubnetFilter.byIds(["1234","5678"])]
       },
      privateDnsEnabled: false,
      securityGroups: [lambdaSg],
    })

    const apiResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: ['execute-api:Invoke'],
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*'],
          conditions: {
            StringNotEquals: {
              'aws:SourceVpc': privateVpc.vpcId,
            },
          },
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*'],
        }),
      ],
    })

    const api = new aws_apigateway.LambdaRestApi(this, `lambda-rest-api`, {
      handler: fnEndpoint,
      proxy: true,
      deployOptions: {
        stageName: "dev",
      },
      endpointConfiguration: {
        types: [aws_apigateway.EndpointType.PRIVATE],
        vpcEndpoints: [interfaceVpcEndpoint],
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
      policy: apiResourcePolicy,
    })

    // ParameterHelper.putParameter(
    //   this,
    //   `/my-app/endpoint/my-api`,
    //   `https://${api.restApiId}-${interfaceVpcEndpoint.vpcEndpointId}.execute-api.${this.variables.env?.region}.amazonaws.com/${this.variables.envName}/`,
    // )

  }
}
