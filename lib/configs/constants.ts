import { DeployEnvEnum } from "lib/context/types";

export const PROJECT = "learn";

// SSM PARAMETERS
export const ENV_SSM_PARAMETER = `/cdk/${PROJECT}/env`;
export const INFRA_STATUS_SSM_PARAMETER = {
  [DeployEnvEnum.DEV]: `/cdk/${PROJECT}/infraStatusDev`,
  [DeployEnvEnum.STG]: `/cdk/${PROJECT}/infraStatusStg`,
};

export const ENV_CONFIG = {
  [DeployEnvEnum.DEV]: {
    cidrBlock: "10.0.0.0/16",
    domainName: "dev.ndc.learn.com",
  },
  [DeployEnvEnum.STG]: {
    cidrBlock: "10.1.0.0/16",
    domainName: "stg.ndc.learn.com",
  },
  [DeployEnvEnum.PROD]: {
    cidrBlock: "10.2.0.0/16",
    domainName: "prod.ndc.learn.com",
  },
};
