import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ExerciseVideo = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [keypoints, setKeypoints] = useState([]);

  // Fetch keypoints from GIF frames
  const fetchKeypointsFromGIF = async () => {
    const response = await axios.post('http://localhost:5000/api/extract-keypoints-from-gif');
    setKeypoints(response.data);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter exercise (e.g., squats)"
        value={exerciseName}
        onChange={(e) => setExerciseName(e.target.value)}
      />
      <button onClick={fetchKeypointsFromGIF}>Extract Keypoints from GIF</button>
      <div>
        {keypoints.length > 0 && (
          <ul>
            {keypoints.map((kp, index) => (
              <li key={index}>{JSON.stringify(kp)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ExerciseVideo;
