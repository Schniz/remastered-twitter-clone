import { redirectBack } from "~app/redirectBack";
import { ActionFn, redirectTo } from "remastered";
import { prisma } from "~app/db";
import { getSession, getUser } from "~app/session";

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export const action: ActionFn = async ({ request }) => {
  await sleep(1500);
  const session = await getSession(request);
  const user = await getUser(request);

  if (!user) {
    session.flash("error", "Please sign in to continue.");
    return redirectTo("/sessions/new", {
      headers: {
        "Set-Cookie": await session.commit(),
      },
    });
  }

  const data = new URLSearchParams(await request.text());
  const text = data.get("text")?.trim();

  if (!text?.length) {
    session.flash("notice", "No message! please write more message!");
    return redirectBack(request, {
      fallback: "/",
      headers: { "Set-Cookie": await session.commit() },
    });
  }

  await prisma.tweet.create({
    data: {
      text,
      user: { connect: { username: user.username } },
    },
  });

  session.flash("notice", "Tweet sent successfuly.");

  return redirectBack(request, {
    fallback: `/`,
    headers: { "Set-Cookie": await session.commit() },
  });
};
