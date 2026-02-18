const express = require("express")
const path = require("path")
const data = require("./movies.json")

const app = express();

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/api/movies", (req, res) => {
    res.json(data.movies)
})

app.listen(8080, () => {
    console.log(`Serveur démarré sur le port 8080`)
});