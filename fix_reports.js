import fs from 'fs';

let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf-8');

// Fix the map errors on highlights/mistakes
content = content.replace(/selectedParamDetail\.highlights\.map/g, "selectedParamDetail?.highlights?.map");
content = content.replace(/selectedParamDetail\.mistakes\.map/g, "selectedParamDetail?.mistakes?.map");

// Fix overallNonVerbalScore
content = content.replace(/report\.videoAnalysis\.overallNonVerbalScore/g, "report.videoAnalysis?.overallVideoScore");

// Fix eyeContact
content = content.replace(/report\.videoAnalysis\.eyeContact\.score/g, "report.videoAnalysis?.eyeContact?.score");
content = content.replace(/report\.videoAnalysis\.eyeContact\.optimalDurationPercentage/g, "report.videoAnalysis?.eyeContact?.directGazePercentage");
content = content.replace(/report\.videoAnalysis\.eyeContact\.downwardGlancePercentage/g, "report.videoAnalysis?.eyeContact?.downwardGazePercentage");
content = content.replace(/report\.videoAnalysis\.eyeContact\.status/g, "report.videoAnalysis?.eyeContact?.status");

// Fix facialExpressions
content = content.replace(/report\.videoAnalysis\.facialExpressions\.dominantState/g, "report.videoAnalysis?.facialExpressions?.dominantState");
content = content.replace(/report\.videoAnalysis\.facialExpressions\.distribution\.composed/g, "report.videoAnalysis?.facialExpressions?.expressionBreakdown?.neutralPct");
content = content.replace(/report\.videoAnalysis\.facialExpressions\.distribution\.attentive/g, "report.videoAnalysis?.facialExpressions?.expressionBreakdown?.attentivePct");
content = content.replace(/report\.videoAnalysis\.facialExpressions\.distribution\.smiling/g, "report.videoAnalysis?.facialExpressions?.expressionBreakdown?.confidentPct");

// Fix confidenceAndStability -> confidence
content = content.replace(/report\.videoAnalysis\.confidenceAndStability\.score/g, "report.videoAnalysis?.confidence?.score");
content = content.replace(/report\.videoAnalysis\.confidenceAndStability\.motionStabilityIndex/g, "report.videoAnalysis?.confidence?.microFidgetingIndex");
content = content.replace(/report\.videoAnalysis\.confidenceAndStability\.nervousFidgetingRating/g, "report.videoAnalysis?.confidence?.headStability");

// Fix engagement
content = content.replace(/report\.videoAnalysis\.engagement\.score/g, "report.videoAnalysis?.engagement?.score");
content = content.replace(/report\.videoAnalysis\.engagement\.activeListeningGestures/g, "report.videoAnalysis?.engagement?.activeListeningNods");
content = content.replace(/report\.videoAnalysis\.engagement\.headNoddingFrequency/g, "report.videoAnalysis?.engagement?.forwardPostureRatio");

// Fix speakingConsistency
content = content.replace(/report\.videoAnalysis\.speakingConsistency\.score/g, "report.videoAnalysis?.speakingConsistency?.score");
content = content.replace(/report\.videoAnalysis\.speakingConsistency\.mouthMovementVsAudioSync/g, "report.videoAnalysis?.speakingConsistency?.audioVisualSync");
content = content.replace(/report\.videoAnalysis\.speakingConsistency\.speakingCadenceStability/g, "report.videoAnalysis?.speakingConsistency?.paceConsistency");

// Fix bodyLanguageAndPosture -> bodyLanguage
content = content.replace(/report\.videoAnalysis\.bodyLanguageAndPosture\.score/g, "report.videoAnalysis?.bodyLanguage?.score");
content = content.replace(/report\.videoAnalysis\.bodyLanguageAndPosture\.centeringRating/g, "report.videoAnalysis?.professionalism?.framingScore");
content = content.replace(/report\.videoAnalysis\.bodyLanguageAndPosture\.postureCategory/g, "report.videoAnalysis?.bodyLanguage?.postureAlignment");

// Fix evidenceObservations -> evidenceTimeline
content = content.replace(/report\.videoAnalysis\.evidenceObservations/g, "report.videoAnalysis?.evidenceTimeline");

// Fix diagnostics
content = content.replace(/report\.videoAnalysis\.diagnostics/g, "report.videoAnalysis?.diagnostics");

fs.writeFileSync('src/components/ReportsView.tsx', content);
