from flask import Flask, jsonify, send_file, request, send_from_directory
from flask_cors import CORS
import requests
import os
from PIL import Image, ImageSequence
import cv2
import mediapipe as mp
import json
import numpy as np
import fastdtw
import time


app = Flask(__name__)
CORS(app)

RAPIDAPI_HOST = "exercisedb.p.rapidapi.com"
RAPIDAPI_KEY = "59436e7874msh31f6a0a4b5d9b6cp14f424jsn556356495d92"

headers = {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': RAPIDAPI_KEY
}

mp_pose = mp.solutions.pose
pose = mp_pose.Pose()

current_similarity_score = 0.5  # Start at 0.5
rising = True  # Control whether score is rising or falling


flip_indices = {
    11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15,  # Arms
    23: 24, 24: 23, 25: 26, 26: 25, 27: 28, 28: 27, 29: 30, 30: 29, 31: 32, 32: 31  # Legs
}

TEMP_GIF_DIR = './temp_gif/'
TEMP_FRAMES_DIR = 'C:\\Users\\rohitacharya\\exercise-correction-app\\backend\\frames'

# Ensure temp folder exists
if not os.path.exists(TEMP_GIF_DIR):
    os.makedirs(TEMP_GIF_DIR)

# Function to clean temp folder
def clean_temp_folder():
    for file_name in os.listdir(TEMP_GIF_DIR):
        file_path = os.path.join(TEMP_GIF_DIR, file_name)
        if os.path.isfile(file_path):
            os.unlink(file_path)

@app.route('/api/download-gif', methods=['POST'])
def download_gif():
    gif_url = request.json.get('gifUrl')
    
    if not gif_url:
        return jsonify({"error": "No GIF URL provided"}), 400
    
    clean_temp_folder()  # Clear the folder before downloading
    
    gif_response = requests.get(gif_url, stream=True)
    gif_path = os.path.join(TEMP_GIF_DIR, 'exercise.gif')
    
    if gif_response.status_code == 200:
        with open(gif_path, 'wb') as f:
            f.write(gif_response.content)
        return jsonify({"message": "GIF downloaded successfully", "gif_path": gif_path}), 200
    else:
        return jsonify({"error": "Failed to download GIF"}), 400

# Convert GIF to frames and extract keypoints
def gif_to_frames(gif_path, output_folder):
    cap = cv2.VideoCapture(gif_path)
    frame_count = 0
    keypoints_data = []
    frame_paths = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_path = os.path.join(output_folder, f'frame_{frame_count}.png')
        cv2.imwrite(frame_path, frame)
        frame_paths.append(frame_path)  # Store the frame path

        # Extract keypoints from frame
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(frame_rgb)
        if results.pose_landmarks:
            keypoints = [(lm.x, lm.y, lm.visibility) for lm in results.pose_landmarks.landmark]
            keypoints_data.append(keypoints)

        frame_count += 1

    # Save the keypoints to JSON (important part)
    keypoints_path = os.path.join(output_folder, 'gif_keypoints.json')
    with open(keypoints_path, 'w') as f:
        json.dump(keypoints_data, f)
        print(f"Keypoints saved to {keypoints_path}")  # Added log statement

    cap.release()

    return frame_paths, keypoints_path



def flip_keypoints(keypoints):
    """
    Flip the keypoints by swapping left and right body parts.
    """
    flipped_keypoints = keypoints.copy()
    for left_idx, right_idx in flip_indices.items():
        flipped_keypoints[left_idx], flipped_keypoints[right_idx] = (
            flipped_keypoints[right_idx], flipped_keypoints[left_idx]
        )
    return flipped_keypoints


# Endpoint to extract frames and save keypoints
@app.route('/api/extract-frames-and-keypoints', methods=['POST'])
def extract_frames_and_keypoints():
    gif_path = 'C:\\Users\\rohitacharya\\exercise-correction-app\\backend\\temp_gif\\exercise.gif'
    gif_to_frames(gif_path, TEMP_GIF_DIR)
    return jsonify({"message": "Frames and keypoints extracted successfully"})

# Endpoint to get the start pose keypoints
@app.route('/api/start-pose', methods=['GET'])
def get_start_pose():
    with open(os.path.join(TEMP_FRAMES_DIR, 'starting_pose_keypoints.json'), 'r') as f:
        keypoints = json.load(f)
    print(f"Keypoints: {keypoints}")
    # Serve the first frame and keypoints
    return jsonify({"image_path": f"{TEMP_FRAMES_DIR}\\frame_0.png", "keypoints": keypoints[0]})

@app.route('/api/frames/<filename>')
def serve_frame(filename):
    print(f"Filename: {filename}")
    return send_from_directory(TEMP_FRAMES_DIR, filename)

@app.route('/api/initial-pose-similarity', methods=['POST'])
def initial_pose_similarity():
    data = request.json
    start_pose_keypoints = np.array(data['startPoseKeypoints'])
    user_keypoints = np.array(data['normalizedUserKeypoints'])

    # Calculate Euclidean distance using fastDTW
    distance, _ = fastdtw(start_pose_keypoints, user_keypoints, dist=lambda a, b: np.linalg.norm(a - b))
    similarity_score = 1 / (1 + distance)  # Higher score indicates more similarity

    return jsonify({'similarityScore': similarity_score})


# Similarity for the entire exercise
@app.route('/api/exercise-similarity', methods=['POST'])
def exercise_similarity():
    data = request.json
    expected_keypoints = np.array(data['expectedKeypoints'])  # List of keypoints for each frame
    user_keypoints = np.array(data['userKeypoints'])  # List of keypoints for each frame

    if len(expected_keypoints) != len(user_keypoints):
        return jsonify({"error": "Keypoints for expected and user exercise should have the same length"}), 400

    total_similarity_score = 0
    for expected_frame, user_frame in zip(expected_keypoints, user_keypoints):
        distance, _ = fastdtw(np.array(expected_frame), np.array(user_frame), dist=lambda a, b: np.linalg.norm(a - b))
        similarity_score = 1 / (1 + distance)
        total_similarity_score += similarity_score

    average_similarity = total_similarity_score / len(expected_keypoints)
    
    return jsonify({'averageSimilarityScore': average_similarity})


# Route to serve the frame image
@app.route('/api/frames/<filename>')
def get_frame(filename):
    image_path = os.path.join('C:/Users/rohitacharya/exercise-correction-app/backend/frames', filename)
    if os.path.exists(image_path):
        return send_file(image_path, mimetype='image/png')
    else:
        return jsonify({"error": "Image not found"}), 404

# Function for multidimensional DTW alignment
def md_dtw(teacher_kpts, user_kpts):
    n, m = len(teacher_kpts), len(user_kpts)
    cost = np.full((n + 1, m + 1), np.inf)
    cost[0, 0] = 0
    path = []

    # Compute the cost matrix using Euclidean distance
    for i in range(n):
        for j in range(m):
            dist = np.linalg.norm(teacher_kpts[i] - user_kpts[j], axis=-1)
            cost[i + 1, j + 1] = np.sum(dist) + min(
                cost[i, j + 1],   # Insertion
                cost[i + 1, j],   # Deletion
                cost[i, j])       # Match

    # Backtracking to find the optimal alignment path
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        steps = [cost[i - 1, j - 1], cost[i - 1, j], cost[i, j - 1]]
        min_step = np.argmin(steps)
        if min_step == 0:
            i, j = i - 1, j - 1
        elif min_step == 1:
            i -= 1
        else:
            j -= 1
    path.reverse()

    aligned_teacher = np.array([teacher_kpts[i] for i, _ in path])
    aligned_user = np.array([user_kpts[j] for _, j in path])

    return aligned_teacher, aligned_user, cost[n, m]

# Endpoint to compute similarity using multidimensional DTW
@app.route('/api/dtw-similarity', methods=['POST'])
def dtw_similarity():
    data = request.json
    start_pose_keypoints = np.array(data['startPoseKeypoints'])
    user_keypoints = np.array(data['normalizedUserKeypoints'])

    # Normal comparison
    _, _, normal_distance = md_dtw(start_pose_keypoints, user_keypoints)

    # Flipped comparison
    flipped_user_keypoints = flip_keypoints(user_keypoints)
    _, _, flipped_distance = md_dtw(start_pose_keypoints, flipped_user_keypoints)

    # Take the higher similarity score (lower distance)
    normal_similarity = 1 / (1 + normal_distance)
    flipped_similarity = 1 / (1 + flipped_distance)
    similarity_score = max(normal_similarity, flipped_similarity)

    return jsonify({'similarityScore': similarity_score*3.2})

# @app.route('/api/dtw-similarity', methods=['POST'])
# def dtw_similarity():
#     global current_similarity_score, rising

#     # Simulate a score scheduler: rising initially, then falling
#     if rising:
#         current_similarity_score += 0.01  # Increase the score gradually
#         if current_similarity_score >= 0.95:
#             rising = False  # Start falling after peak
#     else:
#         current_similarity_score -= 0.02  # Decrease the score gradually
#         if current_similarity_score <= 0.5:
#             rising = True  # Start rising again

#     similarity_score = current_similarity_score

#     return jsonify({'similarityScore': similarity_score})

@app.route('/api/gif/exercise.gif')
def serve_gif():
    gif_path = 'C:/Users/rohitacharya/exercise-correction-app/backend/temp_gif/exercise.gif'
    return send_file(gif_path, mimetype='image/gif')


# Extract keypoints using Mediapipe from a frame
def extract_keypoints(frame_path):
    image = cv2.imread(frame_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = pose.process(image_rgb)
    if results.pose_landmarks:
        return [(lm.x, lm.y, lm.z) for lm in results.pose_landmarks.landmark]
    else:
        return None

def extract_best_keypoints(frame_path):
    image = cv2.imread(frame_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = pose.process(image_rgb)
    
    if results.pose_landmarks:
        best_person_keypoints = []
        visibility_score = sum([lm.visibility for lm in results.pose_landmarks.landmark])
        
        # Extract keypoints if visibility score is acceptable
        if visibility_score > 0.5:
            best_person_keypoints = [(lm.x, lm.y, lm.visibility) for lm in results.pose_landmarks.landmark]

        return best_person_keypoints if best_person_keypoints else None
    return None

@app.route('/api/extract-best-keypoints-from-gif', methods=['POST'])
def extract_best_keypoints_from_gif():
    gif_path = 'C:\\Users\\rohitacharya\\exercise-correction-app\\backend\\temp_gif\\exercise.gif'
    output_folder = './frames'
    os.makedirs(output_folder, exist_ok=True)

    # Convert GIF to frames and return the list of frame paths
    frames, kpts = gif_to_frames(gif_path, output_folder)

    if not frames:
        return jsonify({"error": "No frames extracted from GIF"}), 500

    # Extract keypoints from each frame and filter for the best person
    all_keypoints = []
    for frame in frames:
        keypoints = extract_best_keypoints(frame)
        if keypoints:
            all_keypoints.append(keypoints)

    return jsonify(all_keypoints)

@app.route('/api/compare-keypoints', methods=['POST'])
def compare_keypoints():
    data = request.json
    user_keypoints = np.array(data['userKeypoints'])  # Get user keypoints
    gif_keypoints = np.array(data['gifKeypoints'])    # Get gif (teacher's) keypoints

    # Calculate similarity between user and teacher keypoints using multidimensional DTW
    _, _, distance = md_dtw(user_keypoints, gif_keypoints)
    
    # Convert distance to similarity score
    similarity_score = 1 / (1 + distance)

    return jsonify({'similarityScore': similarity_score})



# @app.route('/api/start-pose', methods=['GET'])
# def get_start_pose():
#     # Serve the first frame as an image and the associated keypoints
#     start_frame_path = './temp_gif/frame_0.png'  # Path to the first frame
#     with open('./temp_gif/starting_pose_keypoints.json', 'r') as f:
#         keypoints = json.load(f)
#     return jsonify({"image_path": start_frame_path, "keypoints": keypoints})


@app.route('/api/body-parts', methods=['GET'])
def get_body_parts():
    url = "https://exercisedb.p.rapidapi.com/exercises/bodyPartList"
    response = requests.get(url, headers=headers)
    body_parts = response.json()
    return jsonify(body_parts)

@app.route('/api/exercises/body-part/<body_part>', methods=['GET'])
def get_exercises_by_body_part(body_part):
    url = f"https://exercisedb.p.rapidapi.com/exercises/bodyPart/{body_part}"
    response = requests.get(url, headers=headers)
    exercises = response.json()
    return jsonify(exercises)

@app.route('/api/exercises/name/<exercise_name>', methods=['GET'])
def get_exercise_by_name(exercise_name):
    url = f"https://exercisedb.p.rapidapi.com/exercises/name/{exercise_name}"
    response = requests.get(url, headers=headers)
    exercises = response.json()
    return jsonify(exercises)

@app.route('/api/gif-keypoints/<int:frame_number>', methods=['GET'])
def get_keypoints_for_frame(frame_number):
    keypoints_path = 'C:\\Users\\rohitacharya\\exercise-correction-app\\backend\\frames\\gif_keypoints.json'

    with open(keypoints_path, 'r') as f:
        keypoints = json.load(f)
    
    if frame_number < len(keypoints):
        return jsonify(keypoints[frame_number])
    else:
        return jsonify({"error": "Frame not found"}), 404


# Endpoint to handle GIF and extract frames and keypoints
@app.route('/api/extract-keypoints-from-gif', methods=['POST'])
def extract_keypoints_from_gif():
    gif_path = 'C:\\Users\\rohitacharya\\exercise-correction-app\\backend\\temp_gif\\exercise.gif'
    output_folder = './frames'
    os.makedirs(output_folder, exist_ok=True)

    # Convert GIF to frames
    frames, kpts = gif_to_frames(gif_path, output_folder)

    # Extract keypoints from each frame
    all_keypoints = []
    for frame in frames:
        keypoints = extract_keypoints(frame)
        if keypoints:
            all_keypoints.append(keypoints)

    return jsonify({
        "frames": frames,
        "keypoints_file": kpts
    })

if __name__ == '__main__':
    app.run(debug=True)

