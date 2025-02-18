const express = require('express');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Allow CORS

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        let credentials;
        try {
            credentials = JSON.parse(message); // Expecting JSON input
        } catch (error) {
            ws.send('Error: Invalid authentication format\r\n');
            ws.close();
            return;
        }

        const { username, password, host, port } = credentials;
        if (!username || !password || !host) {
            ws.send('Error: Missing required fields\r\n');
            ws.close();
            return;
        }

        const conn = new Client();
        conn.on('ready', () => {
            ws.send('SSH Connection Established\r\n');

            conn.shell((err, stream) => {
                if (err) {
                    ws.send(`Error: ${err.message}\r\n`);
                    return;
                }

                ws.on('message', (data) => {
                    stream.write(data);
                });

                stream.on('data', (data) => {
                    ws.send(data.toString('utf-8'));
                });

                stream.on('close', () => {
                    ws.send('SSH session closed.\r\n');
                    ws.close();
                    conn.end();
                });
            });
        });

        conn.on('error', (err) => {
            ws.send(`Error: ${err.message}\r\n`);
            ws.close();
        });

        conn.connect({
            host: host,
            port: port || 22,
            username: username,
            password: password,
        });

        ws.on('close', () => {
            conn.end();
        });
    });
});

app.get('/', (req, res) => {
    res.send('WebSocket SSH Server is running.');
});
