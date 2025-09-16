'use client';

import React from 'react';
import VideoGenerator from '@/components/video/VideoGenerator';

export default function VideoGeneratorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <VideoGenerator />
      </div>
    </div>
  );
}
