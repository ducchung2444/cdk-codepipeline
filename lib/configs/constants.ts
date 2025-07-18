import { DeployEnvEnum } from "@/context/types";

export const PROJECT = "learn";
export const ENV_SSM_PARAMETER = `/cdk/${PROJECT}/env`;
export const INFRA_STATUS_SSM_PARAMETER = {
  [DeployEnvEnum.DEV]: `/cdk/${PROJECT}/infraStatusDev`,
  [DeployEnvEnum.STG]: `/cdk/${PROJECT}/infraStatusStg`,
};
