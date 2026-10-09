import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// A new page starts at the top, as with normal links; without this, following a footer link
// left you at the bottom of the next page. Same-page jumps (#reviews-heading) are left alone,
// and so are Back/Forward ("POP"), where the browser restores the old position.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (!hash && navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

export default ScrollToTop;
