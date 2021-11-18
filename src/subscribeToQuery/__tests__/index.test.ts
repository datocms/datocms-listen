import { ChannelErrorData, ErrorData, Options, subscribeToQuery } from "../index";
import pDefer from "p-defer";

type FakeFetchOptions = {
  /** The number of 500 errors to generate, default: 1 **/
  serverErrors?: number;
};

const makeFakeFetch = ({serverErrors = 1}: FakeFetchOptions = {}) => {
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

  return (fetcher as any) as Options<any, any>["fetcher"];
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

  close() {
  }
}

const MockEventSource = (MyEventSource as any) as Options<
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
    const onUpdateEventDefer= pDefer<boolean>();

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

  it("notifies errors", async () => {
    const fetcher = makeFakeFetch({serverErrors: 0});
    const onErrorDefer = pDefer<ErrorData>();

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
      const error = {
        message: "Not Found"
      };
      streams[0].listeners["onerror"].forEach((cb) => cb(error));
    }, 200);

    const error = await onErrorDefer.promise;
    expect(error.error.message).toEqual("Not Found");
  });
});
