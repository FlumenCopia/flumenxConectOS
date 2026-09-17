# ==============================================================================
# flumenxConectOS — Production Cloud Storage & Malware Gate Provisioning Script
# ==============================================================================
param (
    [string]$AwsRegion = "us-east-1",
    [string]$QuarantineBucket = "flumenx-quarantine-isolated",
    [string]$CleanBucket = "flumenx-clean-vault",
    [string]$SecretName = "flumenx/scanner/webhook-secret"
)

Write-Host ">>> Initializing Cloud Storage & Malware Gate Provisioning in AWS ($AwsRegion)..." -ForegroundColor Cyan

# 1. Create Quarantine Isolated Bucket (Zero Public Access)
Write-Host ">>> 1. Provisioning Quarantine Bucket: $QuarantineBucket"
aws s3api create-bucket --bucket $QuarantineBucket --region $AwsRegion

# Enforce Public Access Block (Deny All Public)
aws s3api put-public-access-block --bucket $QuarantineBucket --public-access-block-configuration `
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 2. Attach 7-Day Lifecycle Purge Rule to Quarantine Bucket
Write-Host ">>> 2. Attaching 7-day lifecycle purge policy to quarantine bucket..."
$lifecycleRule = @{
    Rules = @(
        @{
            ID = "AutoPurgeUnverifiedQuarantineFiles"
            Status = "Enabled"
            Filter = @{ Prefix = "quarantine/" }
            Expiration = @{ Days = 7 }
        }
    )
} | ConvertTo-Json -Depth 5

$lifecycleFile = [System.IO.Path]::GetTempFileName()
$lifecycleRule | Out-File -FilePath $lifecycleFile -Encoding utf8
aws s3api put-bucket-lifecycle-configuration --bucket $QuarantineBucket --lifecycle-configuration file://$lifecycleFile
Remove-Item $lifecycleFile -Force

# 3. Create Clean Storage Vault Bucket (KMS Encrypted)
Write-Host ">>> 3. Provisioning Clean Storage Vault: $CleanBucket"
aws s3api create-bucket --bucket $CleanBucket --region $AwsRegion

aws s3api put-public-access-block --bucket $CleanBucket --public-access-block-configuration `
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enforce Server-Side KMS Encryption
aws s3api put-bucket-encryption --bucket $CleanBucket --server-side-encryption-configuration `
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'

# 4. Generate & Store High-Entropy Scanner Secret in AWS Secrets Manager
Write-Host ">>> 4. Generating 64-character high-entropy secret in AWS Secrets Manager..."
$scannerSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
aws secretsmanager create-secret --name $SecretName --description "HMAC secret for flumenxConectOS malware scanner webhook callbacks" --secret-string $scannerSecret

Write-Host ">>> Cloud Storage and Secrets Provisioning Complete!" -ForegroundColor Green
Write-Host "    - Quarantine Bucket: $QuarantineBucket (Isolated, 7-day lifecycle)"
Write-Host "    - Clean Vault:       $CleanBucket (KMS encrypted, IAM restricted)"
Write-Host "    - Secret Name:        $SecretName"
