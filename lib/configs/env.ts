import * as dotenv from 'dotenv';
dotenv.config();

export const ACCOUNT = process.env.ACCOUNT ?? "";
export const REGION = process.env.REGION ?? "";
export const REPO_STRING = process.env.REPO_STRING ?? "";
export const REPO_BRANCH = process.env.REPO_BRANCH ?? "";
export const CODE_CONNECTION_ARN = process.env.CODE_CONNECTION_ARN ?? "";
