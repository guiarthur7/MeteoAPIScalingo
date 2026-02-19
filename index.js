const express = require("express")
const path = require("path")
const data = require("./movies.json")
const { Pool } = require("pg")
const bcrypt = require("bcrypt")

// Connexion PostgreSQL Scalingo
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Créer la table users (supprime l'ancienne si elle existe)
pool.query(`
    DROP TABLE IF EXISTS users CASCADE;
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

const app = express();

app.use(express.json());

app.use('/src', express.static('src'));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"))
})

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "register.html"))
})

app.get("/api/movies", (req, res) => {
    res.json(data.movies)
})

// Route d'inscription
app.post("/api/signup", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Erreur inscription:', error.message, error.code);
        if (error.code === '23505') {
            res.json({ success: false, message: "Ce nom d'utilisateur existe déjà" });
        } else {
            res.json({ success: false, message: error.message || "Erreur lors de l'inscription" });
        }
    }
});

// Route de connexion
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, message: "Nom d'utilisateur et mot de passe requis" });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        
        if (!user) {
            return res.json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
        }
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username
            } 
        });
    } catch (error) {
        res.json({ success: false, message: "Erreur lors de la connexion" });
    }
});

app.listen(process.env.PORT || 8080, () => {
    console.log(`Serveur démarré sur le port 8080`)
});