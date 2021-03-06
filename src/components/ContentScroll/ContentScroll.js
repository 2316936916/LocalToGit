/* eslint jsx-a11y/no-noninteractive-tabindex: 0 */
/* eslint no-param-reassign: 0 */
import {
  memo,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import { css } from '@emotion/react';
import stylePropType from 'react-style-proptype';
import _ from 'lodash';
import Context from './Context';

const performanceNow = () => window.performance.now();
const ANIMATION_TIME = 240;
const PIXEL_STEP = 10;

const ContentScroll = memo(({
  scrollHeight,
  onScroll,
  children,
  height = 0,
  style,
  ...other
}) => {
  const pointerSaved = useRef();
  const [clientHeight, setClientHeight] = useState(height);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef();
  const animationStartSaved = useRef();
  const animationEndSaved = useRef();
  const animateFrameSaved = useRef();
  const scrollTopStartSaved = useRef();
  const scrollTopTargetSaved = useRef();

  useLayoutEffect(() => {
    let animationFrameID = null;
    let observer;
    if (height === 0) {
      observer = new ResizeObserver((entries) => {
        const newClientHeight = entries[0].contentRect.height;
        animationFrameID = window.requestAnimationFrame(() => {
          if (newClientHeight !== clientHeight) {
            setClientHeight(newClientHeight);
          }
        });
      });
      observer.observe(containerRef.current);
    } else if (height !== clientHeight) {
      setClientHeight(height);
    }

    return () => {
      if (observer) {
        observer.disconnect();
        window.cancelAnimationFrame(animationFrameID);
      }
    };
  }, [height, clientHeight, setClientHeight]);

  useEffect(() => {
    if (clientHeight >= scrollHeight) {
      if (scrollTop !== 0) {
        setScrollTop(0);
      }
    } else if (scrollTop > scrollHeight - clientHeight) {
      setScrollTop(scrollHeight - clientHeight);
    }
  }, [clientHeight, scrollHeight, scrollTop]);

  useEffect(() => {
    const handler = (ev) => {
      if (clientHeight < scrollHeight && containerRef.current.contains(ev.target)) {
        ev.preventDefault();
        ev.returnValue = false; // eslint-disable-line
      }
    };
    window.addEventListener('DOMMouseScroll', handler, { passive: false });
    document.addEventListener('wheel', handler, { passive: false });
    window.onwheel = handler;
    window.ontouchmove = handler;
    return () => {
      window.removeEventListener('DOMMouseScroll', handler, { passive: false });
      document.removeEventListener('wheel', handler, { passive: false });
      window.onwheel = null;
      window.ontouchmove = null;
    };
  }, [clientHeight, scrollHeight]);

  const cleanup = useCallback(() => {
    if (animateFrameSaved.current) {
      window.cancelAnimationFrame(animateFrameSaved.current);
    }
    animationStartSaved.current = null;
    animationEndSaved.current = null;
    scrollTopStartSaved.current = null;
    scrollTopTargetSaved.current = null;
    animateFrameSaved.current = null;
  }, []);

  const animate = useCallback((timestamp) => {
    if (scrollTopTargetSaved.current === scrollTopStartSaved.current) {
      setScrollTop(scrollTopTargetSaved.current);
      cleanup();
    } else if (timestamp >= animationEndSaved.current) {
      setScrollTop(scrollTopTargetSaved.current);
      cleanup();
    } else {
      const length = animationEndSaved.current - animationStartSaved.current;
      const progress = Math.max(timestamp - animationStartSaved.current, 0);
      const percentage = progress / length;
      const t = percentage * (2 - percentage);
      const moveTo = (scrollTopTargetSaved.current - scrollTopStartSaved.current) * t;
      if (moveTo !== 0) {
        setScrollTop(scrollTopStartSaved.current + moveTo);
      }
      animateFrameSaved.current = window.requestAnimationFrame(animate);
    }
  }, [cleanup, setScrollTop]);

  useEffect(() => {
    if (scrollTopTargetSaved.current != null && scrollTopTargetSaved.current === scrollTop) {
      cleanup();
    }
    if (onScroll) {
      onScroll(scrollTop);
    }
  }, [scrollTop, onScroll, cleanup]);

  const scroll = useCallback((target) => {
    if (clientHeight < scrollHeight) {
      if (animationStartSaved.current && performanceNow() - animationStartSaved.current < 40) {
        return;
      }
      if (target <= 0) {
        if (scrollTop === 0) {
          return;
        }
        target = 0;
      }
      if (target >= scrollHeight - clientHeight) {
        if (scrollTop === scrollHeight - clientHeight) {
          return;
        }
        target = scrollHeight - clientHeight;
      }
      if (scrollTop === target) {
        cleanup();
        return;
      }

      if (scrollTopTargetSaved.current == null) {
        animateFrameSaved.current = window.requestAnimationFrame(animate);
      }
      if (!animationEndSaved.current) {
        animationStartSaved.current = performanceNow();
        animationEndSaved.current = animationStartSaved.current + ANIMATION_TIME;
      }
      scrollTopStartSaved.current = scrollTop;
      scrollTopTargetSaved.current = target;
    }
  }, [scrollHeight, clientHeight, scrollTop, cleanup, animate]);

  const handleWheel = useCallback((ev) => {
    if (clientHeight < scrollHeight) {
      ev.stopPropagation();
      scroll(ev.deltaY / 2 * PIXEL_STEP + scrollTop);
    }
  }, [scrollTop, clientHeight, scrollHeight, scroll]);

  const handleKeyDow = useCallback((ev) => {
    if (ev.keyCode === 40) {
      scroll(scrollTop + 50);
    } else if (ev.keyCode === 38) {
      scroll(scrollTop - 50);
    }
  }, [scrollTop, scroll]);

  const handleScroll = useCallback((v) => {
    if (v >= 0
      && scrollHeight > clientHeight
      && v <= scrollHeight - clientHeight) {
      setScrollTop(v);
    }
  }, [scrollHeight, clientHeight]);

  const containerStyle = useMemo(() => {
    if (style) {
      return {
        ..._.omit(style, ['height']),
        overflow: 'hidden',
        height: height !== 0 ? height : null,
      };
    }
    return {
      overflow: 'hidden',
      height: height !== 0 ? height : null,
    };
  }, [height, style]);

  const handleTouchMoveOnDoc = (ev) => {
    const y = ev.touches[0].clientY - pointerSaved.current.y;
    setScrollTop((current) => {
      pointerSaved.current = {
        x: ev.touches[0].clientX,
        y: ev.touches[0].clientY,
      };
      const next = current - y;
      if (next < 0) {
        return 0;
      }
      if (next > scrollHeight - clientHeight) {
        return scrollHeight - clientHeight;
      }
      return next;
    });
  };

  const handleTouchEndOnDoc = () => {
    document.removeEventListener('touchmove', handleTouchMoveOnDoc, { passive: false });
    document.removeEventListener('touchend', handleTouchEndOnDoc);
  };

  const handleTouchStart = (ev) => {
    if (scrollHeight > clientHeight) {
      pointerSaved.current = {
        x: ev.touches[0].clientX,
        y: ev.touches[0].clientY,
        scrollTop,
      };
      document.addEventListener('touchend', handleTouchEndOnDoc);
      document.addEventListener('touchmove', handleTouchMoveOnDoc, { passive: false });
    }
  };

  const store = useMemo(() => ({
    scrollTop,
    clientHeight,
    scrollHeight,
    onScroll: handleScroll,
  }), [
    scrollTop,
    clientHeight,
    scrollHeight,
    handleScroll,
  ]);

  return (
    <Context.Provider
      value={store}
    >
      <div
        css={css`
          position: relative;
          height: 100%;
          outline: 0;
        `}
        {...other}
        ref={containerRef}
        onWheel={handleWheel}
        onKeyDown={handleKeyDow}
        onTouchStart={handleTouchStart}
        tabIndex={0}
        style={containerStyle}
      >
        {children}
      </div>
    </Context.Provider>
  );
});

ContentScroll.propTypes = {
  children: PropTypes.any, // eslint-disable-line
  style: stylePropType,
  height: PropTypes.number,
  scrollHeight: PropTypes.number.isRequired,
  onScroll: PropTypes.func,
};

export default ContentScroll;
