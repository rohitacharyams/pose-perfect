// frontend/src/components/ExerciseFeedback.js

import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as posedetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';

function ExerciseFeedback({ selectedExercise }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const loadDetector = async () => {
      const model = posedetection.SupportedModels.MoveNet;
      const detectorConfig = {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      const detector = await posedetection.createDetector(
        model,
        detectorConfig
      );
      setDetector(detector);
    };
    loadDetector();
  }, []);

  useEffect(() => {
    let interval;
    if (detector) {
      interval = setInterval(() => {
        detectPose();
      }, 100);
    }
    return () => clearInterval(interval);
  }, [detector]);

  const detectPose = async () => {
    if (
      typeof webcamRef.current !== 'undefined' &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const pose = await detector.estimatePoses(video);
      drawCanvas(pose);
      provideFeedback(pose);
    }
  };

  const drawCanvas = (pose) => {
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = webcamRef.current.video.videoWidth;
    canvasRef.current.height = webcamRef.current.video.videoHeight;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(
      webcamRef.current.video,
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height
    );

    if (pose && pose[0] && pose[0].keypoints) {
      const keypoints = pose[0].keypoints;

      // Draw keypoints
      keypoints.forEach((keypoint) => {
        if (keypoint.score > 0.5) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
        }
      });
    }
  };

  const provideFeedback = (pose) => {
    // Simplified feedback logic
    if (pose && pose[0] && pose[0].keypoints) {
      const keypoints = pose[0].keypoints;

      // Example: If the exercise is "bicep curl", check elbow angle
      if (selectedExercise.name.toLowerCase().includes('squat')) {
        // Calculate angles and provide feedback for squat
        setFeedback('Performing squat... (feedback logic here)');
      } else {
        setFeedback('Performing exercise... (feedback logic here)');
      }
    } else {
      setFeedback('No pose detected');
    }
  };

  return (
    <div>
      <h2>{selectedExercise.name}</h2>
      <Webcam
        ref={webcamRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 640,
          height: 480,
          opacity: 0, // Hide the original webcam video
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'relative', width: 640, height: 480 }}
      />
      <p>{feedback}</p>
    </div>
  );
}

export default ExerciseFeedback;
