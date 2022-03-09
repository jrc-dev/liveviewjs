import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { html, LiveView, LiveViewSocket, PageTitleDefaults } from ".";

type SessionDataProvider<T extends {csrfToken: string}> = (req: Request) => T;

const emptyVoid = () => {};

export const configLiveViewHandler = <T extends {csrfToken: string}>(
  getPath: string,
  component: LiveView<unknown,unknown>,
  rootView: string,
  signingSecret: string,
  sessionDataProvider: SessionDataProvider<T>,
  pageTitleDefaults: PageTitleDefaults
): [string, (req:Request, res: Response, next: NextFunction) => Promise<void>] => {
  return [getPath, async (req:Request, res: Response, next: NextFunction) => {

    // new LiveViewId for each request
    const liveViewId = nanoid();

    // mock socket
    const liveViewSocket: LiveViewSocket<T> = {
      id: liveViewId,
      connected: false, // ws socket not connected on http request
      context: {} as T,
      sendInternal: emptyVoid,
      repeat: emptyVoid,
      pageTitle: emptyVoid,
      subscribe: emptyVoid,
      pushPatch: emptyVoid,
    }

    // get session data from provider
    const session = sessionDataProvider(req);

    // mount and render component
    const ctx = await component.mount(
      {
        _csrf_token: session.csrfToken,
        _mounts: -1
      },
      session,
      liveViewSocket
    );
    const view = await component.render(ctx, {
      csrfToken: session.csrfToken,
      // TODO render live_components
      live_component: () => Promise.resolve(html``)
    });

    // render the view with all the data
    res.render(rootView, {
      page_title: pageTitleDefaults?.title ?? "",
      page_title_prefix: pageTitleDefaults?.prefix,
      page_title_suffix: pageTitleDefaults?.suffix,
      csrf_meta_tag: req.session.csrfToken,
      liveViewId,
      session: jwt.sign(session, signingSecret),
      // TODO support static assets https://github.com/floodfx/liveviewjs/issues/42
      statics: jwt.sign(JSON.stringify(view.statics), signingSecret),
      inner_content: view.toString()
    })
  }]
}