# datocms-listen

![MIT](https://img.shields.io/npm/l/datocms-listen?style=for-the-badge) ![MIT](https://img.shields.io/npm/v/datocms-listen?style=for-the-badge) [![Build Status](https://img.shields.io/travis/datocms/datocms-listen?style=for-the-badge)](https://travis-ci.org/datocms/datocms-listen)

A lightweight, TypeScript-ready package that offers utilities to work with DatoCMS [Real-time Updates API](https://www.datocms.com/docs/real-time-updates-api) inside a browser.

## Installation

```
npm install datocms-listen
```

## Example

Import `subscribeToQuery` from `datocms-listen` and use it inside your components like this:

```js
import { subscribeToQuery } from "datocms-listen";
å
const unsubscribe = await subscribeToQuery({
  query: `
    query BlogPosts($first: IntType!) {
      allBlogPosts(first: $first) {
        title
        nonExistingField
      }
    }
  `,
  variables: { first: 10 },
  token: "YOUR_TOKEN",
  preview: true,
  onUpdate: (update) => {
    // response is the GraphQL response
    console.log(update.response.data);
  },
  onStatusChange: (status) => {
    // status can be "connected", "connecting" or "closed"
    console.log(status);
  },
  onChannelError: (error) => {
    // error will be something like:
    // {
    //   code: "INVALID_QUERY",
    //   message: "The query returned an erroneous response. Please consult the response details to understand the cause.",
    //   response: {
    //     errors: [
    //       {
    //         fields: ["query", "allBlogPosts", "nonExistingField"],
    //         locations: [{ column: 67, line: 1 }],
    //         message: "Field 'nonExistingField' doesn't exist on type 'BlogPostRecord'",
    //       },
    //     ],
    //   },
    // }
    console.error(error);
  },
});
```

## Initialization options

| prop               | type                                                                                      | required           | description                                                       | default                              |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- | ------------------------------------ |
| query              | string                                                                                    | :white_check_mark: | The GraphQL query to subscribe                                    |                                      |
| token              | string                                                                                    | :white_check_mark: | DatoCMS API token to use                                          |                                      |
| onUpdate           | function                                                                                  | :white_check_mark: | Callback function to receive query update events                  |                                      |
| onChannelError     | function                                                                                  | :x:                | Callback function to receive channelError events                  |                                      |
| onStatusChange     | function                                                                                  | :x:                | Callback function to receive status change events                 |                                      |
| variables          | Object                                                                                    | :x:                | GraphQL variables for the query                                   |                                      |
| preview            | boolean                                                                                   | :x:                | If true, the Content Delivery API with draft content will be used | false                                |
| environment        | string                                                                                    | :x:                | The name of the DatoCMS environment where to perform the query    | defaults to primary environment      |
| reconnectionPeriod | number                                                                                    | :x:                | In case of network errors, the period to wait to reconnect        |                                      |
| fetcher            | a [fetch-like function](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)       | :x:                | The fetch function to use to perform the registration query       | window.fetch                         |
| eventSourceClass   | an [EventSource-like](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) class | :x:                | The EventSource class to use to open up the SSE connection        | window.EventSource                   |
| baseUrl            | string                                                                                    | :x:                | The base URL to use to perform the query                          | `https://graphql-listen.datocms.com` |

## Events

### `onUpdate(update: UpdateData<QueryResult>)`

This function will be called everytime the channel sends an updated query result. The `updateData` argument has the following properties:

| prop     | type   | description                  |
| -------- | ------ | ---------------------------- |
| response | Object | The GraphQL updated response |

### `onStatusChange(status: ConnectionStatus)`

The `status` argument represents the state of the server-sent events connection. It can be one of the following:

- `connecting`: the subscription channel is trying to connect
- `connected`: the channel is open, we're receiving live updates
- `closed`: the channel has been permanently closed due to a fatal error (ie. an invalid query)

### `onChannelError(errorData: ChannelErrorData)`

The `errorData` argument has the following properties:

| prop     | type   | description                                             |
| -------- | ------ | ------------------------------------------------------- |
| code     | string | The code of the error (ie. `INVALID_QUERY`)             |
| message  | string | An human friendly message explaining the error          |
| response | Object | The raw response returned by the endpoint, if available |

## Return value

The function returns a `Promise<() => void>`. You can call the function to gracefully close the SSE channel.