# Put `.env` to SSM Parameter store
```
aws ssm put-parameter \
    --name /cdk/learn/env \
    --value file://.env \
    --type SecureString \
    --overwrite \
    --region ap-northeast-1
```
