from flask import Flask, request, jsonify,render_template
from flask_cors import CORS
import ffmpeg
import subprocess
from transformers import pipeline
import os
from sqlalchemy import create_engine, text
import numpy as np
app = Flask(__name__)
CORS(app)


model = pipeline("automatic-speech-recognition", model="bayartsogt/whisper-small-mn-8")


def connect_to_database():
    try:
        engine = create_engine("use the sql fr2 to connect")
        return engine
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def get_free_slots(building, room_number, day_of_week=None):
    engine = connect_to_database()
    if engine:
        try:
            query = text("""
                SELECT 
                    building,
                    room_number,
                    day_of_week as "Өдөр",
                    start_time as "Эхлэх_Цаг",
                    end_time as "Дуусах_Цаг",
                    status,
                    course,
                    teacher
                FROM classroom 
                WHERE building = :building 
                AND room_number = :room_number 
                AND day_of_week = :day_of_week
                AND status = 'Сул'
                ORDER BY start_time
            """)
            
            with engine.connect() as connection:
                result = connection.execute(
                    query, 
                    {
                        "building": building,
                        "room_number": room_number,
                        "day_of_week": day_of_week
                    }
                )
                
                rows = []
                for row in result:
                    rows.append({
                        "Building": row.building,
                        "Room": row.room_number,
                        "Өдөр": row.Өдөр,
                        "Эхлэх_Цаг": str(row.Эхлэх_Цаг),
                        "Дуусах_Цаг": str(row.Дуусах_Цаг),
                        "Status": row.status,
                        "Course": row.course,
                        "Teacher": row.teacher
                    })
                return rows
                
        except Exception as e:
            print(f"Database query error: {e}")
            return None
        finally:
            engine.dispose()
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        file = request.files['audio']
        file_path = 'uploaded_audio.wav'
        file.save(file_path) 

        print("File saved successfully.")
        
        ffmpeg_cmd = ['ffmpeg', '-i', file_path, 'output.wav']
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        print(f"FFmpeg output: {result.stdout}")
        print(f"FFmpeg error: {result.stderr}")
        
        audio_data = open('output.wav', 'rb').read()
        transcription = model(audio_data)
        text_output = transcription.get("text", "")
        
        os.remove(file_path)
        os.remove('output.wav')
        print(text_output)
        return jsonify({'text': text_output}), 200
        
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    
@app.route('/get_free_slots', methods=['POST'])
def get_slots():
    try:
        data = request.json
        building = data.get('building')
        room_number = data.get('room_number')
        day_of_week = data.get('day_of_week')  

        print(f"Received values - Building: {building}, Room: {room_number}, Day of week: {day_of_week}")
        
        if not building or not room_number or not day_of_week:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        slots = get_free_slots(building, room_number, day_of_week)

        if slots is None:
            return jsonify({'error': 'Failed to get free slots'}), 500
        return jsonify({'slots': slots})
    
    except Exception as e:
        print(f"Error in get_free_slots: {str(e)}")  
        return jsonify({'error': 'Internal Server Error'}), 500 

@app.route('/update_slot_status', methods=['POST'])
def update_slot_status():
    data = request.json
    engine = connect_to_database()
    
    if not engine:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        print("Received update data:", data)
        
        query = text("""
            UPDATE classroom
            SET 
                status = 'Хичээлтэй'
            WHERE building = :building
            AND room_number = :room_number
            AND day_of_week = :day
            AND start_time = cast(:start_time AS time)
            AND end_time = cast(:end_time AS time)
            AND status = 'Сул'
            RETURNING *
        """)
        
        with engine.connect() as connection:
            with connection.begin():
                result = connection.execute(
                    query,
                    {
                        "building": data['building'],
                        "room_number": data['room_number'],
                        "day": data['day'],
                        "start_time": data['start_time'],
                        "end_time": data['end_time']
                    }
                )
                
                updated_row = result.fetchone()
                if updated_row is not None:
                    return jsonify({
                        'success': True,
                        'message': 'Slot updated successfully'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'message': 'No matching slot found or slot already booked'
                    }), 404
                
    except Exception as e:
        print(f"Database update error: {e}")
        return jsonify({
            'error': str(e),
            'message': 'Failed to update slot status'
        }), 500
    finally:
        engine.dispose()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
