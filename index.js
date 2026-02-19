const express = require("express")
const path = require("path")
const data = require("./movies.json")
const { Pool } = require("pg")

// Connexion PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const app = express();

// Parser le JSON dans les requêtes
app.use(express.json());

app.use('/src', express.static('src'));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"))
})

app.get("/api/movies", (req, res) => {
    res.json(data.movies)
})

pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => console.error('Erreur création table:', err));

// Route d'inscription
app.post("/api/signup", async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
        return res.json({ success: false, error: "Email et mot de passe requis" });
    }
    
    try {
        // Vérifier si l'email existe déjà
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.json({ success: false, error: "Cet email existe déjà" });
        }
        
        // Insérer le nouvel utilisateur (⚠️ mot de passe non hashé pour l'instant)
        const result = await pool.query(
            'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, password, name]
        );
        
        res.json({ 
            success: true, 
            message: "Compte créé avec succès",
            user: result.rows[0] 
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Route de connexion
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.json({ success: false, error: "Email et mot de passe requis" });
    }
    
    try {
        const result = await pool.query(
            'SELECT id, email, name, password FROM users WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect" });
        }
        
        const user = result.rows[0];
        
        // Vérifier le mot de passe (⚠️ comparaison simple pour l'instant)
        if (user.password !== password) {
            return res.json({ success: false, error: "Email ou mot de passe incorrect" });
        }
        
        // Connexion réussie
        res.json({ 
            success: true, 
            message: "Connexion réussie",
            user: { 
                id: user.id, 
                email: user.email, 
                name: user.name 
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.listen(process.env.PORT || 8080, () => {
    console.log(`Serveur démarré sur le port 8080`)
});