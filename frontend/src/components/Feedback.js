import React, { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { poseLandmarksState, selectedExerciseState } from '../state/atoms';

const Feedback = () => {
  const poseLandmarks = useRecoilValue(poseLandmarksState);
  const selectedExercise = useRecoilValue(selectedExerciseState);

  useEffect(() => {
    if (poseLandmarks.length && selectedExercise) {
      const feedback = comparePoses(poseLandmarks, selectedExercise.keypoints);
      document.getElementById('feedback').innerText = feedback;
    }
  }, [poseLandmarks, selectedExercise]);

  const comparePoses = (userPose, exerciseKeypoints) => {
    if (!userPose || !exerciseKeypoints) return 'No data available';

    // Example comparison logic: check left shoulder position
    const userLeftShoulder = userPose[11];
    const exerciseLeftShoulder = exerciseKeypoints[11];

    const dx = Math.abs(userLeftShoulder.x - exerciseLeftShoulder.x);
    const dy = Math.abs(userLeftShoulder.y - exerciseLeftShoulder.y);

    if (dx > 0.1 || dy > 0.1) {
      return 'Adjust your left shoulder!';
    }

    return 'Good form!';
  };

  return <div id="feedback" style={{ fontSize: '20px', color: 'red' }}>No feedback yet.</div>;
};

export default Feedback;
