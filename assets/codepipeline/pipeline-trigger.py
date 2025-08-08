import json
import boto3
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

ssm = boto3.client('ssm')
codepipeline = boto3.client('codepipeline')
events_client = boto3.client('events')

# READ ENV VARIABLES
PIPELINE_NAME = os.environ['PIPELINE_NAME']
SSM_PARAMETER_NAME = os.environ['SSM_PARAMETER_NAME']

def lambda_handler(event, context):
    status = event['status']
    if status in ('on', 'off'):
        trigger_pipeline(status)
        return ok()


def trigger_pipeline(infra_status: str):
    """Write SSM parameter then kick off the pipeline"""
    ssm.put_parameter(
        Name = SSM_PARAMETER_NAME,
        Value = infra_status,
        Type = 'String',
        Overwrite = True,
        Description = 'learn infra status (set by Lambda)',
    )

    logger.info(f'Updated {SSM_PARAMETER_NAME} to {infra_status}')
    response = codepipeline.start_pipeline_execution(
        name=PIPELINE_NAME,
        variables=[{"name": "TRIGGER", "value": "lambda"}]
    )
    logger.info(f'Pipeline started - execution id {response["pipelineExecutionId"]}')


def ok():
    return { 'statusCode': 200, 'body': json.dumps('Processed') }
