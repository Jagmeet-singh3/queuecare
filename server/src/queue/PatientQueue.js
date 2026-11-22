/**
 * QueueCare: Hospital/Clinic Waiting-Time Management
 * Data Structure: PatientQueue (Doubly-Linked List FIFO Queue)
 *
 * ============================================================================
 * SOFTWARE ENGINEERING DESIGN JUSTIFICATION (FOR TECHNICAL VIVA DEFENSE):
 * ============================================================================
 * 1. WHY A QUEUE INSTEAD OF A PLAIN ARRAY OR VECTOR?
 *    - In an array or vector, removing an element from the front (dequeue / pop_front)
 *      requires shifting every subsequent element one position to the left in memory.
 *      This incurs an O(n) time complexity per completed consultation.
 *    - In contrast, a linked-list-based queue maintains explicit 'head' and 'tail'
 *      pointers. Enqueue (adding a walk-in or newly booked patient) and Dequeue
 *      (calling the next patient into the consultation room) are guaranteed O(1)
 *      constant-time pointer updates, regardless of how large the patient line grows.
 *    - A FIFO (First-In, First-Out) queue mathematically models medical fairness:
 *      patients who check in first are prioritized in their arrival order.
 *
 * 2. TRADE-OFF ANALYSIS FOR SKIP / RE-INSERTION:
 *    - When a doctor clicks "Skip" (e.g., patient stepped out to the restroom or pharmacy),
 *      the patient is removed from their current position and re-inserted 'k' spots back
 *      (default k = 3).
 *    - In an array, this would trigger two massive memory copies: shifting left by 1 on removal,
 *      then shifting right by 1 on insertion.
 *    - In our doubly-linked queue, locating position (index + k) requires traversing at most
 *      k nodes: O(k) time complexity. Because k is a small fixed constant (k = 3), this
 *      operation takes negligible time (effectively O(1) in practical clinical settings)
 *      with zero array rebuilding.
 * ============================================================================
 */

class QueueNode {
  /**
   * @param {Object} data Patient appointment metadata
   * @param {number} data.appointmentId Database appointment ID
   * @param {string} data.tokenDisplay Formatted token (e.g. "A37")
   * @param {number} data.tokenNumber Integer sequence number for the day
   * @param {number} data.patientId User ID of patient
   * @param {string} data.patientName Full name of patient
   * @param {number} data.skipCount Number of times this token has been skipped
   */
  constructor(data) {
    this.data = data;
    this.next = null;
    this.prev = null;
  }
}

class PatientQueue {
  constructor(doctorId = null) {
    this.doctorId = doctorId;
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  /**
   * Enqueue: Adds a patient to the rear of the queue.
   * Time Complexity: O(1)
   * @param {Object} patientData
   * @returns {number} New size of queue
   */
  enqueue(patientData) {
    const node = new QueueNode(patientData);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this._size++;
    return this._size;
  }

  /**
   * Dequeue: Removes and returns the patient at the front of the queue.
   * Time Complexity: O(1)
   * @returns {Object|null} Dequeued patient data or null if empty
   */
  dequeue() {
    if (!this.head) {
      return null;
    }
    const removedNode = this.head;
    this.head = this.head.next;

    if (this.head) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }

    this._size--;
    removedNode.next = null;
    removedNode.prev = null;
    return removedNode.data;
  }

  /**
   * Peek: Returns the front patient without removing them.
   * Time Complexity: O(1)
   * @returns {Object|null}
   */
  peek() {
    return this.head ? this.head.data : null;
  }

  /**
   * Size of the queue.
   * Time Complexity: O(1)
   * @returns {number}
   */
  size() {
    return this._size;
  }

  /**
   * Check if queue has no patients.
   * Time Complexity: O(1)
   * @returns {boolean}
   */
  isEmpty() {
    return this._size === 0;
  }

  /**
   * Remove a specific patient by appointmentId or tokenDisplay (e.g. on cancellation).
   * Time Complexity: O(n) search + O(1) pointer splice
   * @param {string|number} identifier
   * @returns {Object|null} Removed patient data or null
   */
  remove(identifier) {
    let curr = this.head;
    while (curr) {
      if (curr.data.appointmentId === identifier || curr.data.tokenDisplay === identifier) {
        if (curr.prev) {
          curr.prev.next = curr.next;
        } else {
          this.head = curr.next;
        }

        if (curr.next) {
          curr.next.prev = curr.prev;
        } else {
          this.tail = curr.prev;
        }

        this._size--;
        curr.next = null;
        curr.prev = null;
        return curr.data;
      }
      curr = curr.next;
    }
    return null;
  }

  /**
   * Skip: Moves the specified patient back by `positions` (default 3 spots).
   * Time Complexity: O(k) where k is positions to skip.
   * If there are fewer than k patients behind them, moves them to the end of the queue.
   * Also increments the patient's skipCount.
   *
   * @param {string|number} identifier appointmentId or tokenDisplay
   * @param {number} positions Number of spots to push back (default 3)
   * @returns {{ patient: Object, newPosition: number, skipCount: number }|null}
   */
  skip(identifier, positions = 3) {
    if (this._size <= 1) {
      // Cannot skip if only 0 or 1 patient in queue
      if (this.head && (this.head.data.appointmentId === identifier || this.head.data.tokenDisplay === identifier)) {
        this.head.data.skipCount = (this.head.data.skipCount || 0) + 1;
        return { patient: this.head.data, newPosition: 1, skipCount: this.head.data.skipCount };
      }
      return null;
    }

    // Step 1: Find target node
    let target = this.head;
    let oldPos = 1;
    while (target) {
      if (target.data.appointmentId === identifier || target.data.tokenDisplay === identifier) {
        break;
      }
      target = target.next;
      oldPos++;
    }

    if (!target) {
      return null;
    }

    // Increment skipCount
    target.data.skipCount = (target.data.skipCount || 0) + 1;

    // Step 2: Detach target node
    if (target.prev) {
      target.prev.next = target.next;
    } else {
      this.head = target.next;
    }

    if (target.next) {
      target.next.prev = target.prev;
    } else {
      this.tail = target.prev;
    }

    this._size--; // Temporarily decrement during re-positioning

    // Step 3: Find insert position (advance 'positions' nodes forward)
    let insertAfter = target.prev; // start from where it was
    let steps = 0;
    let pointer = target.next; // start scanning forward from following node

    while (pointer && steps < positions) {
      insertAfter = pointer;
      pointer = pointer.next;
      steps++;
    }

    // Step 4: Re-insert node
    if (!insertAfter) {
      // Re-insert at head
      target.prev = null;
      target.next = this.head;
      if (this.head) {
        this.head.prev = target;
      }
      this.head = target;
      if (!this.tail) {
        this.tail = target;
      }
    } else {
      // Insert after insertAfter
      target.prev = insertAfter;
      target.next = insertAfter.next;
      if (insertAfter.next) {
        insertAfter.next.prev = target;
      } else {
        this.tail = target;
      }
      insertAfter.next = target;
    }

    this._size++;

    // Calculate new 1-based position
    const newPos = this.getPosition(target.data.appointmentId);
    return {
      patient: target.data,
      newPosition: newPos,
      skipCount: target.data.skipCount
    };
  }

  /**
   * Get 1-based queue position of a patient.
   * @param {string|number} identifier
   * @returns {number} 1-based position or -1 if not found
   */
  getPosition(identifier) {
    let curr = this.head;
    let pos = 1;
    while (curr) {
      if (curr.data.appointmentId === identifier || curr.data.tokenDisplay === identifier) {
        return pos;
      }
      curr = curr.next;
      pos++;
    }
    return -1;
  }

  /**
   * Find patient by identifier without mutating.
   * @param {string|number} identifier
   * @returns {Object|null}
   */
  find(identifier) {
    let curr = this.head;
    while (curr) {
      if (curr.data.appointmentId === identifier || curr.data.tokenDisplay === identifier) {
        return curr.data;
      }
      curr = curr.next;
    }
    return null;
  }

  /**
   * Convert queue to Array of patient objects in FIFO order.
   * Useful for DB synchronization, logging, and JSON responses.
   * @returns {Array<Object>}
   */
  toArray() {
    const list = [];
    let curr = this.head;
    while (curr) {
      list.push({ ...curr.data });
      curr = curr.next;
    }
    return list;
  }

  /**
   * Clear the queue entirely.
   */
  clear() {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }
}

module.exports = { PatientQueue, QueueNode };
