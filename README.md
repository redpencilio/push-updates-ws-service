# Push-updates websocket version

The used prefixes are:
```
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX mupush: <http://mu.semte.ch/vocabularies/push/>
```

This is the backend providing push updates to be used in polling
The backend will provide a push update for a tab given the tab id, which should be stored in the `MU-TAB-ID` header.

The push update will be returned in the following json format when receiving it via the socket
```
{
    data: <the rdf:value of the push update>,
    realm: <the mupush:realm of the push update>,
    type: <the mupush:type of the push update>
}
```

This service needs delta messages from the [delta notifier](https://github.com/mu-semtech/delta-notifier) in the `v0.0.1` [format](https://github.com/mu-semtech/delta-notifier#delta-formats), with a predicate filter for mupush:tabId.

These delta messages have to be sent to `/.mu/delta` with method `POST`


The semantic model of a push update is defined in [this file](./model.md)

## Environment variables

| Environment variable | Explanation |
| --- | --- |
| `PUSH_UPDATES_DELETE_AFTER_CONSUMTION` | Whether or not a push update should be deleted after consuming it |
| `PUSH_UPDATES_SORTING_METHOD` | The method of sorting on the creation date: "ASC" or "DESC" all other values are interpreted as no sorting |
| `PUSH_UPDATES_REFRESH_TIMEOUT` | The refresh timeout to check for new push updates in ms |
| `PUSH_UPDATES_MAX_TIMEOUT` | The maximum timeout for a request in seconds |

