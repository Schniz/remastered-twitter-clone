import type { Tweet, User } from "@prisma/client";
import { getSession, getUser } from "~app/session";
import React from "react";
import {
  Link,
  LoaderFn,
  useRouteData,
  useForm,
  FormComponent,
  ParamLink,
  routePath,
} from "remastered";
import { prisma } from "~app/db";

type ShowableTweet = Pick<Tweet, "created_at" | "text"> & {
  user: Pick<User, "username" | "display_name">;
  id?: Tweet["id"];
};

type Data = {
  tweets: ShowableTweet[];
  currentUser: User | null;
  notice?: string;
};

export const loader: LoaderFn<Data> = async ({ request }) => {
  const session = await getSession(request);
  const notice = session.get("notice");
  const currentUser = await getUser(request);

  return {
    ...(typeof notice === "string" ? { notice } : {}),
    currentUser,
    tweets: await prisma.tweet.findMany({
      take: 20,
      orderBy: {
        created_at: "desc",
      },
      include: {
        user: {
          select: { username: true, display_name: true },
        },
      },
    }),
  };
};

export default function Home() {
  const routeData = useRouteData<Data>();
  const [Form, pendingFormSubmits] = useForm();
  const pendingTweets = pendingFormSubmits
    .map((pfs): ShowableTweet => {
      return {
        text: (pfs.data.get("text") as string) ?? "Nothing!",
        created_at: new Date(),
        user: {
          username: routeData.currentUser!.username,
          display_name: routeData.currentUser!.display_name,
        },
      };
    })
    .reverse();

  const allTweets = [...pendingTweets, ...routeData.tweets];

  return (
    <div>
      {routeData.currentUser ? (
        <ComposeTweetForm
          currentUsername={routeData.currentUser.username}
          form={Form}
        />
      ) : (
        <div>
          You are not logged in. <Link to="sessions/new">Log in</Link> or{" "}
          <Link to="users/new">Sign up</Link>
        </div>
      )}
      <h1 className="font-bold">Latest Tweets</h1>
      {routeData.notice && (
        <div className="font-bold text-red-500">{routeData.notice}</div>
      )}
      {allTweets.length === 0 ? (
        <div>No tweets yet. Be the first!</div>
      ) : (
        <ul className="py-4 space-y-4">
          {allTweets.map((tweet) => {
            return (
              <li
                key={tweet.id ?? tweet.text}
                className={tweet.id ? "" : "opacity-50"}
              >
                <TweetView tweet={tweet} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TweetView({ tweet }: { tweet: ShowableTweet }) {
  return (
    <>
      <span>
        <span>{tweet.user.display_name}</span>{" "}
        <ParamLink
          className="opacity-75"
          route="/@:userId/"
          params={{ userId: tweet.user.username }}
        >
          @{tweet.user.username}
        </ParamLink>{" "}
        {!tweet.id ? (
          <span>[pending submit]</span>
        ) : (
          <ParamLink
            route="/@:userId/:tweetId"
            params={{ userId: tweet.user.username, tweetId: String(tweet.id) }}
          >
            at{" "}
            <time
              suppressHydrationWarning
              dateTime={tweet.created_at.toISOString()}
            >
              {tweet.created_at.toLocaleString()}
            </time>
          </ParamLink>
        )}
      </span>
      <blockquote className="pl-2">{tweet.text}</blockquote>
    </>
  );
}

function ComposeTweetForm(props: {
  currentUsername: string;
  form: FormComponent;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <div>
      <span className="block">Speak your mind</span>
      <props.form
        action={routePath("/@:userId/new", { userId: props.currentUsername })}
        method="post"
        replace
        ref={formRef}
      >
        <textarea
          onKeyDown={(event) => {
            const superKey = event.metaKey || event.ctrlKey;
            if (superKey && event.key === "Enter") {
              formRef.current?.dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
              );
            }
          }}
          placeholder="... I'm thinking about ..."
          name="text"
        ></textarea>
        <button type="submit">Submit</button>
      </props.form>
    </div>
  );
}
