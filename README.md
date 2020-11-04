# datocms-listen

![MIT](https://img.shields.io/npm/l/datocms-listen?style=for-the-badge) ![MIT](https://img.shields.io/npm/v/datocms-listen?style=for-the-badge) [![Build Status](https://img.shields.io/travis/datocms/datocms-listen?style=for-the-badge)](https://travis-ci.org/datocms/datocms-listen)

A set of components and utilities to work faster with [DatoCMS](https://www.datocms.com/) in React environments. Integrates seamlessy with [DatoCMS's GraphQL Content Delivery API](https://www.datocms.com/docs/content-delivery-api).

- TypeScript ready;
- Compatible with IE11;
- CSS-in-JS ready;
- Compatible with any GraphQL library (Apollo, graphql-hooks, graphql-request, etc.);
- Usable both client and server side;
- Compatible with vanilla React, Next.js and pretty much any other React-based solution;

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


  - [Demos](#demos)
  - [Installation](#installation)
- [Live real-time updates](#live-real-time-updates)
  - [Reference](#reference)
  - [Usage](#usage)
  - [Initialization options](#initialization-options)
  - [Connection status](#connection-status)
  - [Error object](#error-object)
  - [Example](#example)
- [Progressive/responsive image](#progressiveresponsive-image)
  - [Out-of-the-box features](#out-of-the-box-features)
  - [Usage](#usage-1)
  - [Example](#example-1)
  - [Props](#props)
    - [The `ResponsiveImage` object](#the-responsiveimage-object)
- [Social share, SEO and Favicon meta tags](#social-share-seo-and-favicon-meta-tags)
  - [Usage](#usage-2)
  - [Example](#example-2)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

```
npm install datocms-listen
```

# Live real-time updates

`useQuerySubscription` is a React hook that you can use to implement client-side updates of the page as soon as the content changes. It uses DatoCMS's [GraphQL server-sent events (SSE)](#) protocol to receive the updated query results in real-time, and is able to reconnect in case of network failures.

Live updates are great both to get instant previews of your content while editing it inside DatoCMS, or to offer real-time updates of content to your visitors (ie. news site).

## Reference

Import `useQuerySubscription` from `datocms-listen` and use it inside your components like this:

```js
const {
  data: QueryResult | undefined,
  error: ChannelErrorData | null,
  status: ConnectionStatus,
} = useQuerySubscription(options: Options);
```

## Initialization options

| prop               | type                                                                                | required           | description                                                       | default                              |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- | ------------------------------------ |
| enabled            | boolean                                                                             | :x:                | Whether the subscription has to be performed or not               | true                                 |
| query              | string                                                                              | :white_check_mark: | The GraphQL query to subscribe                                    |                                      |
| token              | string                                                                              | :white_check_mark: | DatoCMS API token to use                                          |                                      |
| variables          | Object                                                                              | :x:                | GraphQL variables for the query                                   |                                      |
| preview            | boolean                                                                             | :x:                | If true, the Content Delivery API with draft content will be used | false                                |
| environment        | string                                                                              | :x:                | The name of the DatoCMS environment where to perform the query    | defaults to primary environment      |
| initialData        | Object                                                                              | :x:                | The initial data to use on the first render                       |                                      |
| reconnectionPeriod | number                                                                              | :x:                | In case of network errors, the period to wait to reconnect        |                                      |
| fetch              | a [fetch-like function](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) | :x:                | The fetch function to use to perform the registration query       | window.fetch                         |
| baseUrl            | string                                                                              | :x:                | The base URL to use to perform the query                          | `https://graphql-listen.datocms.com` |

## Connection status

The `status` property represents the state of the server-sent events connection. It can be one of the following:

- `connecting`: the subscription channel is trying to connect
- `connected`: the channel is open, we're receiving live updates
- `closed`: the channel has been permanently closed due to a fatal error (ie. an invalid query)

## Error object

| prop     | type   | description                                             |
| -------- | ------ | ------------------------------------------------------- |
| code     | string | The code of the error (ie. `INVALID_QUERY`)             |
| message  | string | An human friendly message explaining the error          |
| response | Object | The raw response returned by the endpoint, if available |

## Example

```js
import React from "react";
import { useQuerySubscription } from "datocms-listen";

const App: React.FC = () => {
  const { status, error, data } = useQuerySubscription({
    enabled: true,
    query: `
      query AppQuery($first: IntType) {
        allBlogPosts {
          slug
          title
        }
      }`,
    variables: { first: 10 },
    token: "YOUR_API_TOKEN",
  });

  const statusMessage = {
    connecting: "Connecting to DatoCMS...",
    connected: "Connected to DatoCMS, receiving live updates!",
    closed: "Connection closed",
  };

  return (
    <div>
      <p>Connection status: {statusMessage[status]}</p>
      {error && (
        <div>
          <h1>Error: {error.code}</h1>
          <div>{error.message}</div>
          {error.response && (
            <pre>{JSON.stringify(error.response, null, 2)}</pre>
          )}
        </div>
      )}
      {data && (
        <ul>
          {data.allBlogPosts.map((blogPost) => (
            <li key={blogPost.slug}>{blogPost.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
```
