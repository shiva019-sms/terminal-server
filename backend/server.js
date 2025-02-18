const express = require('express');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Start Express server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrades (REQUIRED for Render)
server.on('upgrade', (request, socket, head) => {
    console.log("Upgrading WebSocket connection...");
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', (message) => {
        let credentials;
        try {
            credentials = JSON.parse(message);
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
            console.log(`Connected to SSH: ${host}`);
            ws.send('SSH Connection Established\r\n');

            conn.shell((err, stream) => {
                if (err) {
                    ws.send(`Error: ${err.message}\r\n`);
                    ws.close();
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
            console.error("SSH Error:", err.message);
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

// HTTP Endpoint (for testing)
app.get('/', (req, res) => {
    res.send('WebSocket SSH Server is running.');
});
