import type * as GraphQLWeb from '@0no-co/graphql.web';
import { print } from '@0no-co/graphql.web';
import {
  type BuildRequestHeadersOptions,
  buildRequestHeaders,
} from '@datocms/cda-client';

/** A GraphQL `DocumentNode` with attached generics for its result data and variables.
 *
 * @remarks
 * A GraphQL {@link DocumentNode} defines both the variables it accepts on request and the `data`
 * shape it delivers on a response in the GraphQL query language.
 *
 * To bridge the gap to TypeScript, tools may be used to generate TypeScript types that define the shape
 * of `data` and `variables` ahead of time. These types are then attached to GraphQL documents using this
 * `TypedDocumentNode` type.
 *
 * Using a `DocumentNode` that is typed like this will cause any `urql` API to type its input `variables`
 * and resulting `data` using the types provided.
 *
 * @privateRemarks
 * For compatibility reasons this type has been copied and internalized from:
 * https://github.com/dotansimha/graphql-typed-document-node/blob/3711b12/packages/core/src/index.ts#L3-L10
 *
 * @see {@link https://github.com/dotansimha/graphql-typed-document-node} for more information.
 */

export type TypedDocumentNode<
  Result = { [key: string]: any },
  Variables = { [key: string]: any },
> = GraphQLWeb.DocumentNode & {
  /** Type to support `@graphql-typed-document-node/core`
   * @internal
   */
  __apiType?: (variables: Variables) => Result;
  /** Type to support `TypedQueryDocumentNode` from `graphql`
   * @internal
   */
  __ensureTypesOfVariablesAndResultMatching?: (variables: Variables) => Result;
};

export type UpdateData<QueryResult> = {
  /** The raw GraphQL response */
  response: {
    /** GraphQL response `data` property */
    data: QueryResult;
  };
};

export type ChannelErrorData = {
  /** The code of the error (ie. `INVALID_QUERY`) */
  code: string;
  /** An human friendly message explaining the error */
  message: string;
  /** If the error is not fatal (ie. the query is invalid), the query will be retried after some time */
  fatal: boolean;
  /** The raw error response, if available */
  response?: any;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'closed';

export type EventData = {
  /** The current status of the connection **/
  status: ConnectionStatus;
  /** The current channelUrl **/
  channelUrl: string;
  /** An event description **/
  message: string;
  /** Complete HTTP response */
  response: Response;
};

export type Options<QueryResult, QueryVariables> =
  BuildRequestHeadersOptions & {
    /** The GraphQL query to subscribe, or a TypedDocumentNode */
    query: string | TypedDocumentNode<QueryResult, QueryVariables>;
    /** GraphQL variables for the query */
    variables?: QueryVariables;
    /** In case of network errors, the period to wait to reconnect */
    reconnectionPeriod?: number;
    /** The fetch function to use to perform the registration query */
    fetcher?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    /** The EventSource class to use to open up the SSE connection */
    eventSourceClass?: {
      new (
        url: string,
        eventSourceInitDict?: EventSourceInit | undefined,
      ): EventSource;
      prototype: EventSource;
      readonly CLOSED: number;
      readonly CONNECTING: number;
      readonly OPEN: number;
    };
    /** The base URL to use to perform the query (defaults to `https://graphql-listen.datocms.com`) */
    baseUrl?: string;
    /** Callback function to call on status change */
    onStatusChange?: (status: ConnectionStatus) => void;
    /** Callback function to call on query result updates */
    onUpdate: (updateData: UpdateData<QueryResult>) => void;
    /** Callback function to call on channel errors */
    onChannelError?: (errorData: ChannelErrorData) => void;
    /** Callback function to call on other errors */
    onError?: (errorData: MessageEvent) => void;
    /** Callback function to call on events during the connection lifecycle */
    onEvent?: (eventData: EventData) => void;
  };

export type UnsubscribeFn = () => void;

class MessageEventMock<T> {
  type: string;
  data: T;

  constructor(type: string, options: { data: T }) {
    this.type = type;
    this.data = options?.data;
  }
}

const MessageEventClass: typeof MessageEvent =
  typeof MessageEvent !== 'undefined'
    ? MessageEvent
    : (MessageEventMock as any);

export class Response500Error extends Error {
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    Object.setPrototypeOf(this, Response500Error.prototype);
    this.response = response;
  }
}

export class Response400Error extends Error {
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    Object.setPrototypeOf(this, Response400Error.prototype);
    this.response = response;
  }
}

export class InvalidResponseError extends Error {
  response: Response;

  constructor(message: string, response: Response) {
    super(message);
    Object.setPrototypeOf(this, InvalidResponseError.prototype);
    this.response = response;
  }
}

export async function subscribeToQuery<
  QueryResult = unknown,
  QueryVariables = unknown,
>(options: Options<QueryResult, QueryVariables>): Promise<UnsubscribeFn> {
  const {
    query,
    variables,
    fetcher: customFetcher,
    eventSourceClass: customEventSourceClass,
    onStatusChange,
    onUpdate,
    onChannelError,
    onError,
    onEvent,
    reconnectionPeriod: customReconnectionPeriod,
    baseUrl: customBaseUrl,
    ...headerOptions
  } = options;

  const fetcher = customFetcher || window.fetch;
  const EventSourceClass = customEventSourceClass || window.EventSource;
  const reconnectionPeriod = Math.min(customReconnectionPeriod || 1000, 20000);
  const baseUrl = customBaseUrl || 'https://graphql-listen.datocms.com';

  const waitAndReconnect = async () => {
    await new Promise((resolve) => setTimeout(resolve, reconnectionPeriod));
    return subscribeToQuery({
      ...options,
      reconnectionPeriod:
        reconnectionPeriod * 2.0 * (1.0 + (Math.random() * 0.2 - 0.1)),
    });
  };

  let channelUrl: string;

  if (onStatusChange) {
    onStatusChange('connecting');
  }

  try {
    const realQuery = typeof query === 'string' ? query : print(query);

    const req = await fetcher(baseUrl, {
      headers: buildRequestHeaders(headerOptions),
      method: 'POST',
      body: JSON.stringify({ query: realQuery, variables }),
    });

    if (req.status >= 300 && req.status < 500) {
      throw new Response400Error(
        `Invalid status code: ${req.status} ${req.statusText}`,
        req,
      );
    }

    if (req.status >= 500) {
      throw new Response500Error(
        `Invalid status code: ${req.status} ${req.statusText}`,
        req,
      );
    }

    if (req.headers.get('Content-Type') !== 'application/json') {
      throw new InvalidResponseError(
        `Invalid content type: ${req.headers.get('Content-Type')}`,
        req,
      );
    }

    const registration = await req.json();

    channelUrl = registration.url;
    if (onEvent) {
      onEvent({
        status: 'connecting',
        channelUrl,
        message: 'Received channel URL',
        response: req,
      });
    }
  } catch (e) {
    if (onError) {
      const event = new MessageEventClass<Error>('FetchError', { data: e });
      onError(event);
    }

    if (e instanceof Response400Error) {
      throw e;
    }

    if (onStatusChange) {
      onStatusChange('closed');
    }

    return waitAndReconnect();
  }

  return new Promise((resolve) => {
    const eventSource = new EventSourceClass(channelUrl);
    let stopReconnecting = false;

    const unsubscribe = () => {
      if (eventSource.readyState !== 2) {
        stopReconnecting = true;
        eventSource.close();
      }
    };

    eventSource.addEventListener('open', () => {
      if (onStatusChange) {
        onStatusChange('connected');
      }
      resolve(unsubscribe);
    });

    const statusCheck = setInterval(() => {
      if (eventSource.readyState === 2) {
        clearInterval(statusCheck);

        if (onStatusChange) {
          onStatusChange('closed');
        }

        if (!stopReconnecting) {
          waitAndReconnect();
        }
      }
    }, 300);

    eventSource.addEventListener('update', (event) => {
      const updateData = JSON.parse(
        (event as any).data,
      ) as UpdateData<QueryResult>;
      onUpdate(updateData);
    });

    eventSource.addEventListener('channelError', (event) => {
      const errorData = JSON.parse((event as any).data) as ChannelErrorData;

      if (errorData.fatal) {
        stopReconnecting = true;
      }

      if (onChannelError) {
        onChannelError(errorData);
      }

      eventSource.close();
    });

    eventSource.addEventListener('onerror', (event) => {
      const messageEvent = event as MessageEvent;
      if (onError) {
        onError(messageEvent);
      }

      eventSource.close();
    });
  });
}
