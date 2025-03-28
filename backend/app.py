from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def get_db_connection():
    try:
        conn = psycopg2.connect("postgresql://postgres:123@localhost:5432/chatbot")
        return conn
    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        raise

@app.route('/check-users', methods=['GET'])
def check_users():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({"users": [{"id": user[0], "name": user[1]} for user in users]})
    except Exception as e:
        logger.error(f"Error checking users: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        logger.debug(f"Login attempt with data: {data}") 
        
        oyutan = data.get("oyutan")
        password = data.get("password")
        
        if not oyutan or not password:
            return jsonify({"message": "Missing credentials"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        logger.debug("Executing user authentication query")
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        columns = [col[0] for col in cursor.fetchall()]
        logger.debug(f"Table columns: {columns}") 
        cursor.execute("SELECT * FROM users WHERE oyutan = %s AND password = %s", (oyutan, password))
        user = cursor.fetchone()
        
        if user:
            logger.info("Login successful")
            return jsonify({"name": user[1]}), 200  
        else:
            logger.warning("Login failed - invalid credentials")
            return jsonify({"message": "Invalid credentials"}), 401
            
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"message": f"Login error: {str(e)}"}), 500
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    app.run(debug=True)