import {
    app,
    uuid,
    query,
    sparqlEscape
} from "mu";
import * as WebSocket from 'ws';
import * as http from 'http';
import bodyParser from "body-parser";

let deleteAfterConsumption = process.env.PUSH_UPDATES_DELETE_AFTER_CONSUMPTION;
let sort = process.env.PUSH_UPDATES_SORTING_METHOD || "" // must be "ASC" or "DESC" all other values are interpreted as falsy (no sorting)

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
app.use(bodyParser.json());

// A map containing a counter per tabId to indicate how many new push updates are ready for that tab
let readyTabIds = {}
let sockets = {}

const server = http.createServer(app)
const wss = new WebSocket.Server({server})
wss.on('connection', function(ws, req){
    console.log('connection opened')
    let id;
    ws.on('message', function(msg){
        let data = JSON.parse(msg);
        id = data.id
        if (id){
            sockets[id] = ws
        }
        console.log(`Identified connection for ${id}`)
    })
    ws.on('close', function(msg){
        delete sockets[id]
        console.log(`Closing connection for ${id}`)
    })
})
server.listen(3456)

async function generatePushUpdate(id){
    let sorting = ""
    if (["ASC", "DESC"].includes(sort)) {
        sorting = `ORDER BY ${sort}(?date)`
    }
    // Query one push update for the given tab
    let q = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX mupush: <http://mu.semte.ch/vocabularies/push/>
    PREFIX dc:  <http://purl.org/dc/terms/>
    SELECT ?update
    WHERE {
      GRAPH <http://mu.semte.ch/application> {
        ?update mupush:tabId "${id}";
                dc:created ?date;
                a mupush:PushUpdate .
      }
    }
    ${sorting}
    LIMIT 1`;
    let response = await query(q)
    let idSock = sockets[id]

    // Get the details of the push update and return them
    if (response.results.bindings.length > 0 && idSock !== undefined) {
        let resourceUrl = response.results.bindings[0].update.value;
        q = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX mupush: <http://mu.semte.ch/vocabularies/push/>
        SELECT ?data ?type ?realm
        WHERE {
          GRAPH <http://mu.semte.ch/application> {
            <${resourceUrl}>    rdf:value ?data;
                                mupush:realm ?realm;
                                mupush:type ?type.
          }
        }`;
        response = await query(q)
        let pushUpdate = response.results.bindings[0];
        idSock.send(JSON.stringify({
            data: JSON.parse(pushUpdate.data.value),
            realm: pushUpdate.realm,
            type: pushUpdate.type
        }))
        if (deleteAfterConsumption) {
            q = `
            WITH <http://mu.semte.ch/application>
            DELETE
                {?s ?p ?o}
            WHERE {
                FILTER (?s = <${resourceUrl}> )
                ?s ?p ?o
            }`
            query(q)
                .then(() => {
                    console.log(`Deleting ${resourceUrl} from database worked`)
                })
                .catch((error) => {
                    console.error(error)
                })
        }
    }
}


// Process delta messages comming in
app.post("/.mu/delta", async function(req, res) {
    console.log("Got delta")
    console.log(new Date())

    res.status(204).send()

    // Since we're only interested in new push updates being made, we don't check the deletes
    for (let delta of req.body) {
        for (let entry of delta.inserts) {
            // If the insert has the predicate tabId, check the value and update the counter for that tab-id
            if (entry.predicate.value === 'http://mu.semte.ch/vocabularies/push/tabId') {
                generatePushUpdate(entry.object.value)
                break;
            }
        }
    }
})
