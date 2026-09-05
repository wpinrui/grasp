/**
 * What a page framing GRASP tells it.
 *
 * GRASP draws its own cursor and hides the platform's, placing it from the
 * last pointer event it saw. Framed in a page, the frame can move out from
 * under a pointer that has not moved: the page scrolls, and nothing inside the
 * frame hears about it, so the drawn cursor would sit at a spot the pointer
 * left. The page says so instead, since it is the only one that knows.
 */
export const HOST_MOVED = "grasp:host-moved";
