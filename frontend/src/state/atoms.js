import { atom } from 'recoil';

// Atom to store selected exercise details
export const selectedExerciseState = atom({
  key: 'selectedExerciseState',
  default: null,
});

// Atom to store pose landmarks (user's pose data)
export const poseLandmarksState = atom({
  key: 'poseLandmarksState',
  default: [],
});
