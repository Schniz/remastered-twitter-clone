import React from "react";
import { useLocation, useNavigate } from "react-router";
import { REMASTERED_JSON_ACCEPT } from "remastered/dist/constants";
import * as megajson from "remastered/dist/megajson";

function createTx(): string {
  return String(Math.random());
}

type PendingSubmit = {
  tx: string;
  encType: string;
  method: string;
  data: FormData;
  action: string;
  _visitedPath?: string;
};

export function useForm() {
  const location = useLocation();
  const [pendingSubmits, setPendingSubmits] = React.useState<PendingSubmit[]>(
    []
  );

  React.useEffect(() => {
    const tx = (location.state as any)?._remastered_submitted_tx as
      | string
      | undefined;
    if (tx) {
      setPendingSubmits((ps) => {
        const filtered = ps.filter((x) => x.tx !== tx);
        if (filtered.length !== ps.length) {
          return filtered;
        } else {
          return ps;
        }
      });
    }
  }, [location]);
  const FormWrapper = React.useMemo(() => {
    return React.forwardRef<
      HTMLFormElement,
      React.ComponentProps<"form"> & {
        /** Submit the form with the browser instead of JavaScript, even if JavaScript is on the page. */
        forceRefresh?: boolean;

        /** Replace the current item in the history stack, instead of adding a new entry on submit */
        replace?: boolean;
      }
    >((props, ref) => (
      <Form ref={ref as any} {...props} setPendingSubmits={setPendingSubmits} />
    ));
  }, []);

  const response = React.useMemo(() => {
    return [FormWrapper, pendingSubmits] as const;
  }, [FormWrapper, pendingSubmits]);

  return response;
}

type CustomFormProps = {
  /** Submit the form with the browser instead of JavaScript, even if JavaScript is on the page. */
  forceRefresh?: boolean;

  /** Replace the current item in the history stack, instead of adding a new entry on submit */
  replace?: boolean;
};
type InternalFormProps = {
  setPendingSubmits(a: React.SetStateAction<PendingSubmit[]>): void;
};
type FormProps = React.ComponentProps<"form"> &
  CustomFormProps &
  InternalFormProps;

const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ setPendingSubmits, forceRefresh, replace, ...formProps }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();
    const onSubmit = React.useCallback(
      async (event: React.FormEvent<HTMLFormElement>) => {
        if (formProps.onSubmit) {
          if (import.meta.env.DEV) {
            console.warn(
              "You passed onSubmit to `Form`, which deactivates the special behavior."
            );
          }

          return formProps.onSubmit(event);
        }

        if (forceRefresh) return;

        event.preventDefault();
        if (event.target instanceof HTMLFormElement) {
          const pendingSubmit: PendingSubmit = {
            tx: createTx(),
            action: event.target.action,
            encType: event.target.enctype,
            method: event.target.method,
            data: new FormData(event.target),
          };

          setPendingSubmits((ps) => [...ps, pendingSubmit]);
          const newUrl = new URL(event.target.action, window.location.href);

          if (pendingSubmit.method.toLowerCase() === "get") {
            formDataToSearchParams(pendingSubmit.data, newUrl.searchParams);
            pendingSubmit._visitedPath = `${newUrl.pathname}${newUrl.search}`;
            navigate(pendingSubmit._visitedPath, {
              replace,
            });
          } else {
            const body =
              pendingSubmit.encType === "multipart/form-data"
                ? pendingSubmit.data
                : formDataToSearchParams(pendingSubmit.data);
            const request = new Request(newUrl.toString(), {
              method: event.target.method,
              headers: {
                "Content-Type": pendingSubmit.encType,
                Accept: REMASTERED_JSON_ACCEPT,
              },
              body,
            });

            fetch(request).then(
              async (result) => {
                const response = megajson.deserialize(
                  await result.json()
                ) as Response;

                const locationHeader = response.headers.get("location");
                if (
                  response.status >= 300 &&
                  response.status < 400 &&
                  locationHeader
                ) {
                  try {
                    const resolvedUrl = new URL(locationHeader);
                    navigate(locationHeader.replace(resolvedUrl.origin, ""), {
                      state: {
                        _remastered_submitted_tx: pendingSubmit.tx,
                      },
                      replace,
                    });
                  } catch {
                    navigate(locationHeader, { replace });
                  }
                }
              },
              (error) => {
                console.error("OH NO", error);
                setPendingSubmits((ps) =>
                  ps.filter((x) => x !== pendingSubmit)
                );
              }
            );
          }
        }
      },
      [forceRefresh, replace, navigate, setPendingSubmits, formProps.onSubmit]
    );

    React.useEffect(() => {
      setPendingSubmits((ps) => {
        const filtered = ps.filter((pendingSubmit) => {
          return (
            pendingSubmit.method !== "get" ||
            pendingSubmit._visitedPath !==
              `${location.pathname}${location.search}`
          );
        });

        if (filtered.length !== ps.length) {
          return filtered;
        }

        return ps;
      });
    }, [setPendingSubmits]);

    const method = formProps.method?.toLowerCase() ?? "get";
    const methodAllowed = ["get", "post"].includes(method);

    return (
      <form
        ref={ref}
        encType="application/x-www-urlencoded"
        {...formProps}
        onSubmit={onSubmit}
        method={methodAllowed ? method : "post"}
      >
        {!methodAllowed && (
          <input type="hidden" name="_remastered_method" value={method} />
        )}
        {formProps.children && formProps.children}
      </form>
    );
  }
);

function formDataToSearchParams(
  formData: FormData,
  searchParams = new URLSearchParams()
): URLSearchParams {
  for (const [key, value] of formData) {
    if (typeof value !== "string") continue;
    searchParams.append(key, value);
  }

  return searchParams;
}
