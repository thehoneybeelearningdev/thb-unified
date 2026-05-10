import React, { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext";
import { toast } from "react-toastify";

const PaymentContext = createContext();

export const PaymentProvider = ({ children }) => {
  const { user, userRole, userName } = useAuth();
  const [loading, setLoading] = useState(false);

  // Create enrollment first, then start payment
  const createEnrollmentAndPay = async (course) => {

    // Only allow students to pay
    if (userRole !== "Student") {
      toast.error("Only students can enroll in courses.");
      return;
    }
    if (!user || !user.email) {
      toast.error("Please login to enroll in the course");
      return;
    }

    // Validate course data
    if (!course || !course.id || !course.title || !course.fee) {
      toast.error("Invalid course data. Please try again.");
      return;
    }

    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL;

      // Step 1: Create enrollment via backend API
      const enrollmentPayload = {
        userId: user.uid,
        courseId: course.id,
        studentName: userName || user.displayName || "",
        email: user.email,
        phone: user.phoneNumber || "",
        courseTitle: course.title,
        amount: course.fee * 100 // Amount in paise
      };



      const enrollmentResponse = await fetch(`${apiUrl}/api/enrollment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollmentPayload),
      });

      if (!enrollmentResponse.ok) {
        const errorData = await enrollmentResponse.json();
        throw new Error(errorData.error || "Failed to create enrollment");
      }

      const { enrollmentId, status, message } = await enrollmentResponse.json();

      if (status === 'exists' && message.includes('already enrolled')) {
        toast.error("You are already enrolled in this course!");
        setLoading(false);
        return;
      }

      // Step 2: Create payment order for this enrollment
      const paymentPayload = {
        enrollmentId: enrollmentId, // Required: existing enrollment ID
        userId: user.uid,
        courseId: course.id,
        amount: course.fee * 100, // Convert to paise
        currency: "INR",
        customerEmail: user.email,
        customerContact: user.phoneNumber || null,
        notes: {
          name: userName || '',
          courseName: course.title
        }
      };



      const response = await fetch(`${apiUrl}/api/payment/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create payment order");
      }

      const { orderId, key, amount, currency } = await response.json();

      // Step 3: Initialize Razorpay payment
      const options = {
        key: key,
        amount: amount,
        currency: currency,
        name: "The Honey Bee",
        description: `Payment for ${course.title}`,
        order_id: orderId,
        handler: async function (razorpayResponse) {
          try {
            const verifyResponse = await fetch(`${apiUrl}/api/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature: razorpayResponse.razorpay_signature,
              }),
            });
            const verifyData = await verifyResponse.json();
            if (verifyResponse.ok) {
              toast.success("Payment successful! Processing enrollment...");

              // Poll enrollment status to confirm webhook update
              let attempts = 0;
              const maxAttempts = 10;
              const pollInterval = 2000; // 2 seconds

              const pollStatus = async () => {
                try {
                  const statusResponse = await fetch(`${apiUrl}/api/enrollment/${enrollmentId}/status`);
                  if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    if (statusData.status === 'Paid') {
                      toast.success("Enrollment confirmed! You are now enrolled in the course.");
                      return true;
                    }
                  }

                  attempts++;
                  if (attempts < maxAttempts) {
                    setTimeout(pollStatus, pollInterval);
                  } else {
                    toast.warning("Payment successful, but enrollment status is still updating. Please refresh the page.");
                  }
                } catch (error) {
                  // Error polling enrollment status
                }
              };

              // Start polling
              setTimeout(pollStatus, 1000);

            } else {
              toast.error(verifyData.error || "Payment verification failed");
            }
          } catch (error) {
            toast.error("Payment verification failed: " + error.message);
          }
        },
        prefill: {
          name: user.displayName || "",
          email: user.email || "",
        },
        theme: { color: "#F7A4A4" }
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

    } catch (error) {
      toast.error("Failed to process payment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Keep this function for backward compatibility
  const startPaymentForEnrollment = async (course, enrollmentId) => {
    // This function is now just a wrapper that calls the main function
    await createEnrollmentAndPay(course);
  };

  return (
    <PaymentContext.Provider value={{
      startPayment: createEnrollmentAndPay, // Use new function as default
      startPaymentForEnrollment, // For existing enrollments
      loading
    }}>
      {children}
    </PaymentContext.Provider>
  );
};

export const usePayment = () => useContext(PaymentContext);
