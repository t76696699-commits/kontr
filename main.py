from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# SQLite ma'lumotlar bazasi
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game_scores.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# Database Modeli
class Leaderboard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer, nullable=False)


# Baza jadvalini yaratish
with app.app_context():
    db.create_all()


# Asosiy sahifa
@app.route('/')
def index():
    return render_template('index.html')


# Ballni bazaga saqlash API
@app.route('/api/score', methods=['POST'])
def save_score():
    data = request.json
    username = data.get('username', 'Player')
    score = data.get('score', 0)

    if not username:
        username = 'Anonim'

    new_score = Leaderboard(username=username, score=score)
    db.session.add(new_score)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Natija saqlandi!'})


# Top-10 reytingni olish API
@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    top_scores = Leaderboard.query.order_by(Leaderboard.score.desc()).limit(10).all()
    results = [{'username': s.username, 'score': s.score} for s in top_scores]
    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)