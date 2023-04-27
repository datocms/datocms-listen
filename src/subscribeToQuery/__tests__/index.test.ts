import {
  ChannelErrorData,
  EventData,
  Options,
  subscribeToQuery,
} from "../index";
import { TypedDocumentNode } from "@graphql-typed-document-node/core";
import pDefer from "p-defer";

type FakeFetchOptions = {
  /** The number of 500 errors to generate, default: 1 **/
  serverErrors?: number;
};

const makeFakeFetch = ({ serverErrors = 1 }: FakeFetchOptions = {}) => {
  let times = 0;

  const fetcher = async () => {
    if (times < serverErrors) {
      times += 1;

      return {
        status: 500,
        statusText: "Server error",
        headers: {
          get: () => "application/json",
        },
        json: async () => ({ url: "foo" }),
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ url: "bar" }),
    };
  };

  return fetcher as any as Options<any, any>["fetcher"];
};

type CallbackFn = (param: any) => void;

type Stream = {
  listeners: Record<string, Array<CallbackFn>>;
};

let streams: Array<Stream> = [];

class MyEventSource {
  stream: Stream;

  constructor() {
    this.stream = { listeners: {} };
    streams.push(this.stream);
  }

  addEventListener(event: string, cb: CallbackFn) {
    this.stream.listeners[event] = [
      ...(this.stream.listeners[event] || []),
      cb,
    ];
  }

  close() {}
}

const MockEventSource = MyEventSource as any as Options<
  any,
  any
>["eventSourceClass"];

describe("subscribeToQuery", () => {
  beforeEach(() => {
    streams = [];
  });

  it("returns an unsubscribe function", async () => {
    const fetcher = makeFakeFetch();

    const unsubscribePromise = subscribeToQuery({
      query: `{ allBlogPosts(first: 1) { title } }`,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {},
    });

    setTimeout(() => {
      if (streams[0].listeners["open"]) {
        streams[0].listeners["open"].forEach((cb) => cb(true));
      }
    }, 100);

    const unsubscribe = await unsubscribePromise;

    expect(unsubscribe).toBeTruthy();
  });

  it("handles channelError fatal events", async () => {
    const fetcher = makeFakeFetch();
    const onChannelErrorDefer = pDefer<ChannelErrorData>();

    subscribeToQuery({
      query: `{ allBlogPosts(first: 1) { title } }`,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {},
      onChannelError: (error) => {
        onChannelErrorDefer.resolve(error);
      },
    });

    setTimeout(() => {
      if (streams[0].listeners["open"]) {
        streams[0].listeners["open"].forEach((cb) => cb(true));
      }
    }, 100);

    setTimeout(() => {
      if (streams[0].listeners["channelError"]) {
        const error = {
          data: JSON.stringify({
            fatal: true,
          }),
        };
        streams[0].listeners["channelError"].forEach((cb) => cb(error));
      }
    }, 200);

    const error = await onChannelErrorDefer.promise;
    expect(error.fatal).toEqual(true);
  });

  it("handles update events", async () => {
    const fetcher = makeFakeFetch();
    const onUpdateEventDefer = pDefer<boolean>();

    subscribeToQuery({
      query: `{ allBlogPosts(first: 1) { title } }`,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {
        onUpdateEventDefer.resolve(data as any as boolean);
      },
    });

    setTimeout(() => {
      if (streams[0].listeners["open"]) {
        streams[0].listeners["open"].forEach((cb) => cb(true));
      }
    }, 100);

    setTimeout(() => {
      if (streams[0].listeners["update"]) {
        const error = {
          data: JSON.stringify(true),
        };
        streams[0].listeners["update"].forEach((cb) => cb(error));
      }
    }, 200);

    const data = await onUpdateEventDefer.promise;
    expect(data).toEqual(true);
  });

  it("handles TypedDocumentNode as query", async () => {
    const fetcher = makeFakeFetch();
    const onUpdateEventDefer = pDefer<boolean>();

    // generated via
    type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

    type HomeQueryVariables = Exact<{ [key: string]: never }>;

    type HomeQuery = {
      __typename?: "Query";
      allArticles: Array<{
        __typename?: "ArticleRecord";
        id: string;
        title: string;
        _createdAt: string;
        _publishedAt?: string | null;
      }>;
    };

    const HomeDocument = {
      kind: "Document",
      definitions: [
        {
          kind: "OperationDefinition",
          operation: "query",
          name: { kind: "Name", value: "Home" },
          selectionSet: {
            kind: "SelectionSet",
            selections: [
              {
                kind: "Field",
                name: { kind: "Name", value: "allArticles" },
                selectionSet: {
                  kind: "SelectionSet",
                  selections: [
                    { kind: "Field", name: { kind: "Name", value: "id" } },
                    { kind: "Field", name: { kind: "Name", value: "title" } },
                    {
                      kind: "Field",
                      name: { kind: "Name", value: "_createdAt" },
                    },
                    {
                      kind: "Field",
                      name: { kind: "Name", value: "_publishedAt" },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    } as unknown as TypedDocumentNode<HomeQuery, HomeQueryVariables>;

    subscribeToQuery({
      query: HomeDocument,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {
        onUpdateEventDefer.resolve(data as any as boolean);
      },
    });

    setTimeout(() => {
      if (streams[0].listeners["open"]) {
        streams[0].listeners["open"].forEach((cb) => cb(true));
      }
    }, 100);

    setTimeout(() => {
      if (streams[0].listeners["update"]) {
        const error = {
          data: JSON.stringify(true),
        };
        streams[0].listeners["update"].forEach((cb) => cb(error));
      }
    }, 200);

    const data = await onUpdateEventDefer.promise;
    expect(data).toEqual(true);
  });

  it("notifies events", async () => {
    const fetcher = makeFakeFetch();
    const onEventDefer = pDefer<EventData>();

    subscribeToQuery({
      query: `{ allBlogPosts(first: 1) { title } }`,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {},
      onEvent: (event) => {
        onEventDefer.resolve(event);
      },
    });

    const event = await onEventDefer.promise;
    expect(event.channelUrl).toEqual("bar");
  });

  it("notifies errors", async () => {
    const fetcher = makeFakeFetch({ serverErrors: 0 });
    const onErrorDefer = pDefer<MessageEvent>();

    subscribeToQuery({
      query: `{ allBlogPosts(first: 1) { title } }`,
      token: `XXX`,
      preview: true,
      environment: "foobar",
      reconnectionPeriod: 10,
      fetcher,
      eventSourceClass: MockEventSource,
      onUpdate: (data) => {},
      onError: (error) => {
        onErrorDefer.resolve(error);
      },
    });

    setTimeout(() => {
      if (streams[0].listeners["open"]) {
        streams[0].listeners["open"].forEach((cb) => cb(true));
      }
    }, 100);

    setTimeout(() => {
      const data = JSON.stringify({
        message: "Not Found",
      });
      const error = new MessageEvent("FetchError", { data });
      streams[0].listeners["onerror"].forEach((cb) => cb(error));
    }, 200);

    const error = await onErrorDefer.promise;
    console.log("error:", error);
    const data = JSON.parse(error.data);
    expect(data.message).toEqual("Not Found");
  });
});
