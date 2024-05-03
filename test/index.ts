import { subscribeToQuery } from '../src';

const unsubscribe = await subscribeToQuery({
  baseUrl:
    process.env.GRAPHQL_LISTEN_BASE_URL || 'https://graphql-listen.datocms.com',
  query: `
    query HomePage($limit: IntType) {
      posts: allPosts(first: $limit, orderBy:_firstPublishedAt_DESC) {
        id
        content
        _firstPublishedAt
        photos {
          responsiveImage(imgixParams: {auto: [format]}) {
            ...imageFields
          }
        }
        author {
          name
          avatar {
            responsiveImage(imgixParams: {auto: [format], w: 60}) {
              ...imageFields
            }
          }
        }
      }
    }

    fragment imageFields on ResponsiveImage {
      aspectRatio
      base64
      height
      sizes
      src
      srcSet
      width
      alt
      title
    }
  `,
  variables: { limit: 10 },
  token: '8fab743fa0cae985d61b9e900888dc',
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
    console.error(error);
  },
  onError: (error) => {
    console.error(error);
  },
  onEvent: (event) => {
    console.log(event);
  },
});

setTimeout(() => {
  unsubscribe();
}, 5000);
