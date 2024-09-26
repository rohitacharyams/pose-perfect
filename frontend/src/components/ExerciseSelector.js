import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ExerciseSelector = () => {
  const [bodyParts, setBodyParts] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showGif, setShowGif] = useState(false);
  const [keypoints, setKeypoints] = useState([]);

  // Fetch body parts
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/api/body-parts')
      .then(response => setBodyParts(response.data))
      .catch(error => console.error('Error fetching body parts:', error));
  }, []);

  // Fetch exercises based on body part
  const fetchExercises = (bodyPart) => {
    axios.get(`http://127.0.0.1:5000/api/exercises/body-part/${bodyPart}`)
      .then(response => setExercises(response.data))
      .catch(error => console.error('Error fetching exercises:', error));
  };

  // Handle body part change
  const handleBodyPartChange = (e) => {
    const bodyPart = e.target.value;
    setSelectedBodyPart(bodyPart);
    fetchExercises(bodyPart);
  };

  // Handle exercise selection
  const handleExerciseChange = (e) => {
    const exerciseName = e.target.value;
    const selected = exercises.find(ex => ex.name === exerciseName);
    setSelectedExercise(selected);
    setShowGif(false);  // Reset GIF visibility when a new exercise is selected
  };

  // Handle GIF download and keypoint extraction
  const handleDownloadGif = async () => {
    if (selectedExercise) {
      try {
        const response = await axios.post('http://127.0.0.1:5000/api/download-gif', {
          gifUrl: selectedExercise.gifUrl,
        });
        if (response.data.gif_path) {
          console.log('GIF downloaded successfully:', response.data.gif_path);
          setShowGif(true);  // Show the GIF after downloading
        }
        const response2 = await axios.post('http://localhost:5000/api/extract-best-keypoints-from-gif');
        setKeypoints(response2.data);
        console.log('Keypoints extracted:', response2.data);
      } catch (error) {
        console.error('Error downloading GIF:', error);
      }
    }
  };

  return (
    <div>
      <h2>Select an Exercise</h2>
      <div>
        <label>Body Part:</label>
        <select value={selectedBodyPart} onChange={handleBodyPartChange}>
          <option value="">--Select Body Part--</option>
          {bodyParts.map(part => (
            <option key={part} value={part}>{part}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Exercise:</label>
        <select onChange={handleExerciseChange}>
          <option value="">--Select Exercise--</option>
          {exercises.map(exercise => (
            <option key={exercise.id} value={exercise.name}>{exercise.name}</option>
          ))}
        </select>
      </div>

      {selectedExercise && (
        <div>
          <button onClick={handleDownloadGif}>Download and Show GIF</button>
          {showGif && (
            <div>
              <h3>{selectedExercise.name}</h3>
              <img src={selectedExercise.gifUrl} alt={`${selectedExercise.name} GIF`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseSelector;
