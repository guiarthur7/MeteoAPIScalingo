const express = require("express")
const path = require("path")

const app = express();

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"))
})

app.get("/meteo", (req, res) => {
    res.send("Salut")
})

app.listen(8000, () => {
    console.log("Serveur démarré avec succès")
});