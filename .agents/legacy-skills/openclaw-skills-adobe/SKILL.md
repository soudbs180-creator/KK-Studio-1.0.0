---
name: adobe-cloud-apis
description: Adobe Creative Cloud API 后端，适用于 Photoshop API、Lightroom、PDF Services 和 Firefly。仅在 `adobe-workbench` 选中云端 API 路线后，或用户明确要求 Adobe API 时使用。
metadata: {"clawdbot":{"emoji":"🎨","requires":{"env":["ADOBE_CLIENT_ID","ADOBE_ACCESS_TOKEN"]}}}
---

# Adobe 云端能力

这是一个后端技能。除非你已经确定任务应使用 Adobe 云端 API，否则请先从 `adobe-workbench` 开始。

这里聚焦于 Adobe 的创意和文档类云端 API。

## 环境变量

```bash
export ADOBE_CLIENT_ID="xxxxxxxxxx"
export ADOBE_ACCESS_TOKEN="xxxxxxxxxx"
```

## Photoshop API - Remove Background

```bash
curl -X POST "https://image.adobe.io/sensei/cutout" \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {"href": "https://example.com/image.jpg", "storage": "external"},
    "output": {"href": "https://your-bucket.s3.amazonaws.com/output.png", "storage": "external"}
  }'
```

## PDF Services - Create PDF

```bash
curl -X POST "https://pdf-services.adobe.io/operation/createpdf" \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "assetID": "{asset_id}"
  }'
```

## PDF Services - Export PDF to Word

```bash
curl -X POST "https://pdf-services.adobe.io/operation/exportpdf" \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "assetID": "{asset_id}",
    "targetFormat": "docx"
  }'
```

## Firefly - Generate Image (AI)

```bash
curl -X POST "https://firefly-api.adobe.io/v2/images/generate" \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A futuristic cityscape at sunset",
    "n": 1,
    "size": {"width": 1024, "height": 1024}
  }'
```

## Lightroom - Get Catalog

```bash
curl "https://lr.adobe.io/v2/catalogs" \
  -H "Authorization: Bearer $ADOBE_ACCESS_TOKEN" \
  -H "x-api-key: $ADOBE_CLIENT_ID"
```

## Links
- Console: https://developer.adobe.com/console
- Docs: https://developer.adobe.com/apis
