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
};

export type Options<QueryResult, QueryVariables> = {
  /** The GraphQL query to subscribe */
  query: string;
  /** GraphQL variables for the query */
  variables?: QueryVariables;
  /** DatoCMS API token to use */
  token: string;
  /**
   * If true, the Content Delivery API with draft content will be used
   * @deprecated use includeDrafts instead
   **/
  preview?: boolean;
  /** If true, draft records will be returned */
  includeDrafts?: boolean;
  /** If true, invalid records will be filtered out */
  excludeInvalid?: boolean;
  /** The name of the DatoCMS environment where to perform the query (defaults to primary environment) */
  environment?: string;
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

class Response500Error extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Response500Error.prototype);
  }
}

class Response400Error extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, Response400Error.prototype);
  }
}

class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidResponseError.prototype);
  }
}

export async function subscribeToQuery<
  QueryResult = any,
  QueryVariables = Record<string, any>,
>(options: Options<QueryResult, QueryVariables>): Promise<UnsubscribeFn> {
  const {
    query,
    token,
    variables,
    preview,
    includeDrafts,
    excludeInvalid,
    environment,
    fetcher: customFetcher,
    eventSourceClass: customEventSourceClass,
    onStatusChange,
    onUpdate,
    onChannelError,
    onError,
    onEvent,
    reconnectionPeriod: customReconnectionPeriod,
    baseUrl: customBaseUrl,
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
    const req = await fetcher(baseUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: `application/json`,
        ...(environment ? { 'X-Environment': environment } : {}),
        ...(includeDrafts || preview ? { 'X-Include-Drafts': 'true' } : {}),
        ...(excludeInvalid ? { 'X-Exclude-Invalid': 'true' } : {}),
      },
      method: 'POST',
      body: JSON.stringify({ query, variables }),
    });

    if (req.status >= 300 && req.status < 500) {
      throw new Response400Error(
        `Invalid status code: ${req.status} ${req.statusText}`,
      );
    }

    if (req.status >= 500) {
      throw new Response500Error(
        `Invalid status code: ${req.status} ${req.statusText}`,
      );
    }

    if (req.headers.get('Content-Type') !== 'application/json') {
      throw new InvalidResponseError(
        `Invalid content type: ${req.headers.get('Content-Type')}`,
      );
    }

    const registration = await req.json();

    channelUrl = registration.url;
    if (onEvent) {
      onEvent({
        status: 'connecting',
        channelUrl,
        message: 'Received channel URL',
      });
    }
  } catch (e) {
    if (e instanceof Response400Error) {
      throw e;
    }

    if (onError) {
      const data = JSON.stringify({ message: e.message });
      const event = new MessageEvent('FetchError', { data });
      onError(event);
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
