#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LambdaPythonApiStack } from '../lib/infrastructure/lambda-python-api-stack';

const app = new cdk.App();
new LambdaPythonApiStack(app, 'LambdaPythonApiStack', {
   env: { account: '123456789012', region: 'us-east-1' },
});