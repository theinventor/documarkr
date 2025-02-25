#!/bin/bash

# List of candidate domains
domains=(
  "Signifyr.com"
  "Signdesk.com"
  "InkedDoc.com"
  "QuickSig.com"
  "SignaGo.com"
  "DocuMarkr.com"
  "ESignet.com"
  "SignMatic.com"
  "SwiftSig.com"
  "SignHive.com"
  "SigNest.com"
  "SigNow.com"
  "SignFolio.com"
  "SignFlow.com"
  "SigSnap.com"
  "SignBridge.com"
  "Signory.com"
  "SignLedger.com"
  "DocuLine.com"
  "SignGrid.com"
  "SignLoop.com"
  "SignBase.com"
  "SignStack.com"
  "SigNexus.com"
  "SignPad.com"
  "SignClip.com"
  "SignGlide.com"
  "SignZing.com"
  "Signaroo.com"
  "Signora.com"
  "DocuScribe.com"
  "DocuNote.com"
  "InkDox.com"
  "SignForge.com"
  "SignCove.com"
  "SignPilot.com"
  "SignWorx.com"
  "InkSigno.com"
  "SignBurst.com"
  "SignCore.com"
  "SignFlare.com"
  "DocuStitch.com"
  "SignFuse.com"
  "DocuFlick.com"
  "InkStamp.com"
  "Signtastic.com"
  "SignBot.com"
  "SignTrak.com"
  "DocuTrail.com"
  "Sigmo.com"
)

echo "Starting domain availability check..."

# Loop over each domain
for domain in "${domains[@]}"; do
  echo "Checking $domain..."
  # Use dig to get any DNS records; adjust timeout if needed.
  result=$(dig +short "$domain")
  if [ -z "$result" ]; then
    echo "$domain appears AVAILABLE."
  else
    echo "$domain is TAKEN."
  fi
done

echo "Domain check complete."

