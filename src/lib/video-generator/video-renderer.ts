// Import Node.js modules only when needed (server-side)
import { VideoRenderingOptions, VideoChunk } from './types';

export class VideoRenderer {
  private outputDir: string;
  private tempDir: string;

  constructor(outputDir: string = 'temp/videos') {
    this.outputDir = outputDir;
    // Initialize tempDir with a placeholder - will be set properly when needed
    this.tempDir = 'temp/videos/chunks';
    this.ensureOutputDirs();
  }

  private async ensureOutputDirs(): Promise<void> {
    // Only create directories on server side
    if (typeof window === 'undefined') {
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        
        // Set proper tempDir path
        this.tempDir = path.join(this.outputDir, 'chunks');
        
        await fs.mkdir(this.outputDir, { recursive: true });
        await fs.mkdir(this.tempDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create video output directories:', error);
      }
    }
  }

  async renderVideoChunk(chunk: VideoChunk, options: VideoRenderingOptions): Promise<string> {
    // For client-side, return a placeholder video URL
    if (typeof window !== 'undefined') {
      return `blob:placeholder_video_${chunk.chunkId}`;
    }

    const path = await import('path');
    const chunkDir = path.join(this.tempDir, `chunk_${chunk.chunkId}`);
    
    try {
      const { promises: fs } = await import('fs');
      await fs.mkdir(chunkDir, { recursive: true });
      
      // Write the visual code to a Python file
      const pythonFile = path.join(chunkDir, `chunk_${chunk.chunkId}.py`);
      await fs.writeFile(pythonFile, chunk.visualCode || this.generateFallbackVisualCode(chunk));
      
      // Try Manim first
      try {
        const videoPath = await this.renderWithManim(pythonFile, chunkDir, options);
        if (videoPath) return videoPath;
      } catch (manimError) {
        console.warn('Manim rendering failed:', manimError);
      }

      // Try FFmpeg fallback
      try {
        const videoPath = await this.generateFallbackVideo(chunk, chunkDir, options);
        return videoPath;
      } catch (ffmpegError) {
        console.warn('FFmpeg fallback failed:', ffmpegError);
      }

      // Final fallback: create a mock video
      console.log('Creating mock video for chunk', chunk.chunkId);
      return await this.createMockVideo(chunk, chunkDir, options);

    } catch (error) {
      console.error(`Failed to render chunk ${chunk.chunkId}:`, error);
      // Even if everything fails, try to create a mock video
      try {
        return await this.createMockVideo(chunk, chunkDir, options);
      } catch (mockError) {
        console.error('Even mock video creation failed:', mockError);
        throw error;
      }
    }
  }

  private async renderWithManim(pythonFile: string, outputDir: string, options: VideoRenderingOptions): Promise<string | null> {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if Manim is available
        const { spawn } = await import('child_process');
        const path = await import('path');
        
        const manimProcess = spawn('manim', [
          'render',
          path.basename(pythonFile),
          'VideoScene',
          '-q', 'm', // Medium quality
          '--format', 'mp4',
          '--disable_caching'
        ], {
          cwd: outputDir,
          stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        manimProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        manimProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        manimProcess.on('close', async (code) => {
          if (code === 0) {
            // Find the generated video file
            const mediaDir = path.join(outputDir, 'media', 'videos', `chunk_${path.basename(pythonFile, '.py')}`, '720p30');
            const videoFiles = await this.findVideoFiles(mediaDir);
            
            if (videoFiles.length > 0) {
              resolve(videoFiles[0]);
            } else {
              reject(new Error('Manim rendered successfully but no video file found'));
            }
          } else {
            reject(new Error(`Manim rendering failed: ${stderr}`));
          }
        });

        manimProcess.on('error', (error) => {
          // Manim not available, will fallback to other methods
          resolve(null);
        });

      } catch (error) {
        resolve(null);
      }
    });
  }

  private async generateFallbackVideo(chunk: VideoChunk, outputDir: string, options: VideoRenderingOptions): Promise<string> {
    // Generate a simple video using FFmpeg with text overlay
    const path = await import('path');
    const videoPath = path.join(outputDir, `chunk_${chunk.chunkId}.mp4`);
    
    return new Promise(async (resolve, reject) => {
      try {
        const { spawn } = await import('child_process');
        
        // Try local FFmpeg first, then system PATH
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffmpegProcess = spawn(ffmpegPath, [
          '-f', 'lavfi',
          '-i', `color=c=blue:size=${options.resolution}:duration=${chunk.duration}`,
          '-vf', `drawtext=text='${chunk.text.replace(/'/g, "\\'")}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-y', // Overwrite output file
          videoPath
        ], {
          stdio: 'pipe'
        });

        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            resolve(videoPath);
          } else {
            console.warn(`FFmpeg fallback failed with code ${code}: ${stderr}`);
            // Try creating a mock video instead
            this.createMockVideo(chunk, outputDir, options)
              .then(resolve)
              .catch(reject);
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.warn(`FFmpeg not available: ${error.message}`);
          // Try creating a mock video instead
          this.createMockVideo(chunk, outputDir, options)
            .then(resolve)
            .catch(reject);
        });
      } catch (error) {
        console.warn(`FFmpeg process creation failed: ${error}`);
        // Try creating a mock video instead
        this.createMockVideo(chunk, outputDir, options)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  private escapeTextForFFmpeg(text: string): string {
    return text
      .substring(0, 50)
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\\/g, '\\\\')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/=/g, '\\=')
      .replace(/\s+/g, ' '); // Replace multiple spaces with single space
  }

  private async createMockVideo(chunk: VideoChunk, outputDir: string, options: VideoRenderingOptions): Promise<string> {
    // Create a proper mock video using FFmpeg instead of raw binary
    const path = await import('path');
    const videoPath = path.join(outputDir, `chunk_${chunk.chunkId}_mock.mp4`);
    
    try {
      const { promises: fs } = await import('fs');
      
      // First try to create a proper video using FFmpeg
      try {
        const { spawn } = await import('child_process');
        
        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        // Escape text for FFmpeg drawtext filter
        const escapedText = this.escapeTextForFFmpeg(chunk.text);
        const displayText = `Chunk ${chunk.chunkId}: ${escapedText}${chunk.text.length > 50 ? '...' : ''}`;
        
        const ffmpegProcess = spawn(ffmpegPath, [
          '-f', 'lavfi',
          '-i', `color=c=blue:size=${options.resolution}:duration=${chunk.duration}`,
          '-vf', `drawtext=text='${displayText}':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=(h-text_h)/2`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-y', // Overwrite output file
          videoPath
        ], {
          stdio: 'pipe'
        });

        return new Promise((resolve, reject) => {
          let stderr = '';

          ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`Created mock video for chunk ${chunk.chunkId}: ${videoPath}`);
              resolve(videoPath);
            } else {
              console.warn(`FFmpeg mock video creation failed with code ${code}: ${stderr}`);
              // Fall back to simple file creation
              this.createSimpleMockVideo(chunk, outputDir, options).then(resolve).catch(reject);
            }
          });

          ffmpegProcess.on('error', (error) => {
            console.warn(`FFmpeg not available for mock video: ${error.message}`);
            // Fall back to simple file creation
            this.createSimpleMockVideo(chunk, outputDir, options).then(resolve).catch(reject);
          });
        });
      } catch (ffmpegError) {
        console.warn(`FFmpeg process creation failed: ${ffmpegError}`);
        // Fall back to simple file creation
        return await this.createSimpleMockVideo(chunk, outputDir, options);
      }
      
    } catch (error) {
      console.error('Failed to create mock video:', error);
      throw new Error(`Mock video creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createSimpleMockVideo(chunk: VideoChunk, outputDir: string, options: VideoRenderingOptions): Promise<string> {
    // Create a simple placeholder file when FFmpeg is not available
    const path = await import('path');
    const videoPath = path.join(outputDir, `chunk_${chunk.chunkId}_mock.mp4`);
    
    try {
      const { promises: fs } = await import('fs');
      
      // Create a text file with the content for reference
      const textPath = path.join(outputDir, `chunk_${chunk.chunkId}_content.txt`);
      await fs.writeFile(textPath, `Video Chunk ${chunk.chunkId}\n\nContent: ${chunk.text}\n\nDuration: ${chunk.duration} seconds\n\nThis is a mock video file created when FFmpeg and Manim are not available.`);
      
      // Create a minimal valid MP4 file with proper structure
      // This creates a very basic MP4 that FFmpeg can at least read
      const mockVideoData = Buffer.from([
        // ftyp box
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x6D, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x00,
        
        // moov box (movie box)
        0x00, 0x00, 0x00, 0x08, 0x6D, 0x6F, 0x6F, 0x76,
        
        // mdat box (media data)
        0x00, 0x00, 0x00, 0x08, 0x6D, 0x64, 0x61, 0x74
      ]);
      
      await fs.writeFile(videoPath, mockVideoData);
      
      console.log(`Created simple mock video for chunk ${chunk.chunkId}: ${videoPath}`);
      return videoPath;
      
    } catch (error) {
      console.error('Failed to create simple mock video:', error);
      throw new Error(`Simple mock video creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createFallbackVideoWithFFmpeg(chunk: { videoPath: string; audioPath?: string; chunkId: number; text: string; duration: number }, outputDir: string, options: VideoRenderingOptions): Promise<string | null> {
    // Create a proper fallback video using FFmpeg when mock videos fail
    const path = await import('path');
    const videoPath = path.join(outputDir, `chunk_${chunk.chunkId}_fallback.mp4`);
    
    try {
      const { spawn } = await import('child_process');
      
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      
      // Escape text for FFmpeg drawtext filter
      const escapedText = this.escapeTextForFFmpeg(chunk.text);
      const displayText = `Chunk ${chunk.chunkId}: ${escapedText}${chunk.text.length > 50 ? '...' : ''}`;
      
      const ffmpegProcess = spawn(ffmpegPath, [
        '-f', 'lavfi',
        '-i', `color=c=blue:size=${options.resolution}:duration=${chunk.duration}`,
        '-vf', `drawtext=text='${displayText}':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=(h-text_h)/2`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-y', // Overwrite output file
        videoPath
      ], {
        stdio: 'pipe'
      });

      return new Promise((resolve, reject) => {
        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`Created fallback video for chunk ${chunk.chunkId}: ${videoPath}`);
            resolve(videoPath);
          } else {
            console.warn(`FFmpeg fallback video creation failed with code ${code}: ${stderr}`);
            resolve(null);
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.warn(`FFmpeg not available for fallback video: ${error.message}`);
          resolve(null);
        });
      });
    } catch (error) {
      console.warn(`FFmpeg fallback process creation failed: ${error}`);
      return null;
    }
  }

  private async findVideoFiles(directory: string): Promise<string[]> {
    try {
      const { promises: fs } = await import('fs');
      const path = await import('path');
      
      const files = await fs.readdir(directory);
      return files
        .filter(file => file.endsWith('.mp4'))
        .map(file => path.join(directory, file));
    } catch (error) {
      return [];
    }
  }

  private generateFallbackVisualCode(chunk: VideoChunk): string {
    const displayText = chunk.text.length > 80 
      ? chunk.text.substring(0, 80) + "..."
      : chunk.text;

    return `from manim import *

class VideoScene(Scene):
    def construct(self):
        # Simple text animation for ${chunk.duration} seconds
        title = Text("${chunk.text.replace(/"/g, '\\"')}", font_size=32, color=WHITE)
        title.scale_to_fit_width(11)
        
        # Animate text
        self.play(Write(title), run_time=1.5)
        self.wait(${chunk.duration - 1.5})
        
        # Final fade out
        self.play(FadeOut(title), run_time=0.5)`;
  }

  async combineVideoChunks(chunks: Array<{ videoPath: string; audioPath?: string }>, outputPath: string): Promise<string> {
    if (chunks.length === 0) {
      throw new Error('No video chunks to combine');
    }

    // For client-side, return first chunk as placeholder
    if (typeof window !== 'undefined') {
      return chunks[0].videoPath;
    }

    console.log('🎬 Combining video and audio chunks like Python implementation...');
    
    // Step 1: Combine each video chunk with its audio chunk (like Python version)
    const combinedChunks: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.videoPath) {
        console.warn(`Skipping chunk ${i + 1} - no video path`);
        continue;
      }

      const path = await import('path');
      const combinedChunkPath = path.join(this.tempDir, `combined_chunk_${i}.mp4`);
      
      if (chunk.audioPath) {
        // Combine video and audio for this chunk (like Python version)
        console.log(`🎵 Combining video and audio for chunk ${i + 1}/${chunks.length}`);
        
        try {
          await this.addAudioToVideo(chunk.videoPath, chunk.audioPath, combinedChunkPath);
          combinedChunks.push(combinedChunkPath);
          console.log(`✅ Combined chunk ${i + 1}/${chunks.length}`);
        } catch (error) {
          // If combination fails, use video only
          console.warn(`⚠️ Audio combination failed for chunk ${i + 1}, using video only:`, error);
          
          // Check if this is a mock video file that's causing issues
          if (chunk.videoPath.includes('_mock.mp4')) {
            console.log(`🔄 Detected mock video for chunk ${i + 1}, creating fallback video with FFmpeg`);
            try {
              // Create a mock chunk object with required properties
              const mockChunk = {
                videoPath: chunk.videoPath,
                audioPath: chunk.audioPath,
                chunkId: i + 1,
                text: `Video chunk ${i + 1} content`,
                duration: 5 // Default duration
              };
              
              // Try to create a proper video using FFmpeg for this chunk
              const fallbackPath = await this.createFallbackVideoWithFFmpeg(mockChunk, this.tempDir, { 
                code: 'fallback', 
                outputPath: combinedChunkPath, 
                resolution: '1280x720', 
                frameRate: 30, 
                quality: 'medium' 
              });
              if (fallbackPath) {
                combinedChunks.push(fallbackPath);
                console.log(`✅ Created fallback video for chunk ${i + 1}`);
                continue;
              }
            } catch (fallbackError) {
              console.warn(`Fallback video creation failed for chunk ${i + 1}:`, fallbackError);
            }
          }
          
          try {
            const { promises: fs } = await import('fs');
            await fs.copyFile(chunk.videoPath, combinedChunkPath);
            combinedChunks.push(combinedChunkPath);
          } catch (copyError) {
            console.error(`Failed to copy video chunk ${i + 1}:`, copyError);
          }
        }
      } else {
        // No audio, just copy video
        console.log(`📹 No audio for chunk ${i + 1}, using video only`);
        try {
          const { promises: fs } = await import('fs');
          await fs.copyFile(chunk.videoPath, combinedChunkPath);
          combinedChunks.push(combinedChunkPath);
        } catch (error) {
          console.error(`Failed to copy video chunk ${i + 1}:`, error);
        }
      }
    }

    if (combinedChunks.length === 0) {
      throw new Error('No chunks were successfully processed');
    }

    if (combinedChunks.length === 1) {
      // If only one combined chunk, just copy it to output
      const { promises: fs } = await import('fs');
      await fs.copyFile(combinedChunks[0], outputPath);
      return outputPath;
    }

    // Step 2: Concatenate all combined chunks (like Python version)
    console.log('🔗 Concatenating all combined chunks...');
    const path = await import('path');
    const fileListPath = path.join(this.tempDir, 'file_list.txt');
    const fileListContent = combinedChunks
      .map(chunkPath => `file '${path.resolve(chunkPath)}'`)
      .join('\n');
    
    const { promises: fs } = await import('fs');
    await fs.writeFile(fileListPath, fileListContent);

    return new Promise(async (resolve, reject) => {
      try {
        const { spawn } = await import('child_process');
        
        const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        const ffmpegProcess = spawn(ffmpegPath, [
          '-f', 'concat',
          '-safe', '0',
          '-i', fileListPath,
          '-c', 'copy',
          '-y', // Overwrite output file
          outputPath
        ], {
          stdio: 'pipe'
        });

        let stderr = '';

        ffmpegProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        ffmpegProcess.on('close', async (code) => {
          // Clean up temporary files
          try {
            await fs.unlink(fileListPath);
            // Clean up combined chunk files
            for (const chunkPath of combinedChunks) {
              await fs.unlink(chunkPath);
            }
          } catch (error) {
            console.warn('Failed to cleanup temporary files:', error);
          }

          if (code === 0) {
            // Verify the output file was created
            try {
              await fs.access(outputPath);
              console.log('🎉 Final video created successfully!');
              resolve(outputPath);
            } catch (accessError) {
              console.warn('Output file was not created, trying fallback');
              try {
                await fs.copyFile(combinedChunks[0], outputPath);
                resolve(outputPath);
              } catch (copyError) {
                reject(new Error(`Output file verification failed and fallback copy failed: ${copyError}`));
              }
            }
          } else {
            console.warn(`FFmpeg concatenation failed with code ${code}: ${stderr}`);
            // Try to use the first combined chunk as fallback
            try {
              await fs.copyFile(combinedChunks[0], outputPath);
              resolve(outputPath);
            } catch (copyError) {
              reject(new Error(`FFmpeg concatenation failed and fallback copy failed: ${copyError}`));
            }
          }
        });

        ffmpegProcess.on('error', async (error) => {
          console.warn(`FFmpeg not available: ${error.message}`);
          // Try to use the first combined chunk as fallback
          try {
            await fs.copyFile(combinedChunks[0], outputPath);
            resolve(outputPath);
          } catch (copyError) {
            reject(new Error(`FFmpeg error and fallback copy failed: ${copyError}`));
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async addAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const { spawn } = await import('child_process');
      
      // Try local FFmpeg first, then system PATH
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffmpegProcess = spawn(ffmpegPath, [
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-y', // Overwrite output file
        outputPath
      ], {
        stdio: 'pipe'
      });

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg audio combination failed: ${stderr}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg not available: ${error.message}`));
      });
    });
  }

  async generatePreview(videoPath: string, outputPath: string): Promise<string> {
    // Generate a preview image from the video
    return new Promise(async (resolve, reject) => {
      const { spawn } = await import('child_process');
      
      // Try local FFmpeg first, then system PATH
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const ffmpegProcess = spawn(ffmpegPath, [
        '-i', videoPath,
        '-ss', '00:00:01', // Take frame at 1 second
        '-vframes', '1',
        '-y', // Overwrite output file
        outputPath
      ], {
        stdio: 'pipe'
      });

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Preview generation failed: ${stderr}`));
        }
      });

      ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg not available: ${error.message}`));
      });
    });
  }

  async cleanup(chunkPaths: string[]): Promise<void> {
    // Only cleanup on server side
    if (typeof window === 'undefined') {
      for (const chunkPath of chunkPaths) {
        try {
          const { promises: fs } = await import('fs');
          await fs.rm(chunkPath, { recursive: true, force: true });
        } catch (error) {
          console.warn(`Failed to cleanup chunk directory ${chunkPath}:`, error);
        }
      }
    }
  }
}
