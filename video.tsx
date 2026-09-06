import React from 'react';

interface VideoReportProps {
  report: {
    videoAnalysis?: {
      overallNonVerbalScore?: number;
      diagnostics?: {
        totalSamples?: number;
      };
    };
  };
}

export const VideoReport: React.FC<VideoReportProps> = ({ report }) => {
  const videoAnalysis = report.videoAnalysis;

  if (!videoAnalysis) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900">Video Interview Analysis</h2>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="block text-slate-500">Non-Verbal Score</span>
          <strong className="text-lg text-slate-900">
            {videoAnalysis.overallNonVerbalScore ?? 0} / 100
          </strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <span className="block text-slate-500">Frames Evaluated</span>
          <strong className="text-lg text-slate-900">
            {videoAnalysis.diagnostics?.totalSamples ?? 0}
          </strong>
        </div>
      </div>
    </section>
  );
};

export default VideoReport;