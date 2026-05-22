resource "aws_iam_policy" "unsafe" {
  name = "unsafe"

  # ruleid: firmcode.infra.terraform.broad-iam-permissions
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "*"
        Resource = "*"
      }
    ]
  })
}

data "aws_iam_policy_document" "unsafe" {
  # ruleid: firmcode.infra.terraform.broad-iam-permissions
  statement {
    effect = "Allow"
    actions = ["*"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "safe" {
  name = "safe"

  # ok: firmcode.infra.terraform.broad-iam-permissions
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = ["arn:aws:s3:::firmcode-artifacts/*"]
      }
    ]
  })
}
