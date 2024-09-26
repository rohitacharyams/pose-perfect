import React from 'react';
import ExerciseSelector from './components/ExerciseSelector';
import PoseDetector from './components/PoseDetector';
import Feedback from './components/Feedback';
import { RecoilRoot } from 'recoil';
import ExerciseVideo from './components/ExerciseVideo';
import WebcamExercise from './components/WebCamExercise';

function App() {
  return (
    <RecoilRoot>
      <div>
        <ExerciseSelector />
        <WebcamExercise />
      </div>
    </RecoilRoot>
  );
}

export default App;
