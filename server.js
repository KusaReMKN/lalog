'use strict';

import express from 'express';
import sqlite3 from 'sqlite3';

const app = express();
const db = new sqlite3.Database('./lalog.db');

app.use(express.json());
app.disable('x-powered-by');

app.get('/', (req, res) =>
    db.all('SELECT hostName FROM hosts;', function (err, rows) {
        if (err) {
            res.status(500)
                .json({ error: err });
            return;
        }
        const result = {};
        result['hosts'] = rows.map(e => e.hostName);
        res.json(result);
    })
);
app.post('/', (req, res) =>
    res.status(405)
        .set('Allow', 'GET, HEAD')
        .json({ error: 'Method Not Allowed' })
);

app.get('/:hostname', (req, res) =>
    db.all(`SELECT logTime, loadavg1, loadavg5, loadavg15
                FROM lalogs JOIN hosts WHERE hostName IS ?;`,
        req.params.hostname, function (err, rows) {
            if (err) {
                res.status(500)
                    .json({ error: err });
                return;
            }
            if (rows.length === 0) {
                res.status(404)
                    .json({ error: 'Unknown Host' });
                return;
            }
            const result = {};
            result[req.params.hostname] = rows.map(e => ({
                datetime: e.logTime,
                loadavg: [ e.loadavg1, e.loadavg5, e.loadavg15 ],
            }));
            res.json(result);
        }
    )
);
app.post('/:hostname', (req, res) => {
    if (!/^application\/json;?/.test(req.get('Content-Type'))) {
        res.status(415)
            .json({ error: 'Content-Type Unsupported' });
        return;
    }
    const loadavg = req.body.loadavg;
    if (!loadavg || !loadavg.length || loadavg.length < 3) {
        res.status(422)
            .json({ error: 'Unprocessable Entity' });
        return;
    }
    db.serialize(() => {
        db.exec('BEGIN TRANSACTION;');
        db.run(`INSERT INTO hosts ( hostName )
                    SELECT ? WHERE ? NOT IN ( SELECT hostName FROM hosts );`,
            req.params.hostname, req.params.hostname, function (err) {
                if (err) {
                console.debug(1);
                    res.status(500)
                        .json({ error: err });
                    db.exec('ROLLBACK TRANSACTION;');
                    return;
                }
            });
        db.run(`INSERT INTO lalogs ( hostId, loadavg1, loadavg5, loadavg15 )
                    SELECT hostId, ?, ?, ? FROM hosts WHERE hostName IS ?;`,
            loadavg[0], loadavg[1], loadavg[2], req.params.hostname,
            function (err) {
                if (err) {
                console.debug(2);
                    res.status(500)
                        .json({ error: err });
                    db.exec('ROLLBACK TRANSACTION;');
                    return;
                }
            });
        db.exec('COMMIT TRANSACTION;', function (err) {
            if (err) {
            console.debug(3);
                res.status(500)
                    .json({ error: err });
                db.exec('ROLLBACK TRANSACTION;');
                return;
            }
            res.json({ message: 'OK' });
        });
    });
});

try {
    db.serialize(() => {
        const throwError = err => { if (err) throw err; };
        db.exec('BEGIN TRANSACTION;', throwError);
        db.exec(`CREATE TABLE IF NOT EXISTS hosts (
                    hostId      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    hostName    TEXT    UNIQUE NOT NULL);`, throwError);
        db.exec(`CREATE TABLE IF NOT EXISTS lalogs (
                    lalogId     INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    hostId      INTEGER NOT NULL REFERENCES hosts ( hostId ),
                    logTime     NUMERIC NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    loadavg1    REAL    NOT NULL,
                    loadavg5    REAL    NOT NULL,
                    loadavg15   REAL    NOT NULL);`, throwError);
        db.exec('COMMIT TRANSACTION;', throwError);
    });
} catch (err) {
    console.error(err);
    process.exit(-1);
}

app.listen(8080);
