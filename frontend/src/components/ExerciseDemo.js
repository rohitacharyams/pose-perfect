// frontend/src/components/ExerciseDemo.js

import React from 'react';

function ExerciseDemo({ selectedExercise, setSelectedExercise }) {
  const handleStartExercise = () => {
    setSelectedExercise({ ...selectedExercise, startExercise: true });
  };

  return (
    <div>
      <h2>{selectedExercise.name}</h2>
      <img
        src={selectedExercise.gifUrl}
        alt={selectedExercise.name}
        width="300"
      />
      <p>Target Muscle: {selectedExercise.target}</p>
      <p>Equipment: {selectedExercise.equipment}</p>
      <button onClick={handleStartExercise}>Start Exercise</button>
      <button onClick={() => setSelectedExercise(null)}>Back</button>
    </div>
  );
}

export default ExerciseDemo;
