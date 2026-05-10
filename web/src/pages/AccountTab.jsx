import { Shield } from "lucide-react";
import "../styles/AccountTab.css";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
const AccountTab = () => {
    const { logout, userRole, userName, currentUser } = useAuth();
    const navigate = useNavigate();
    const handleSignout = async () => {
        try {
            await logout();
            navigate('/');

        } catch (error) {
            toast.error("Logout failed", {
                position: "top-right",
                autoClose: 4000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "light",
            });
        }
    };
    return (
        <div className="account-tab">
            {/* Account Info Section */}
            <div>
                <h3 className="account-section-title">
                    <Shield size={20} />
                    Account Information
                </h3>
                <div className="account-info-grid">
                    <div>
                        <label className="account-info-label">Account Type</label>
                        <p className="account-info-value">{String(userRole || "Guest").replace(/^./, c => c.toUpperCase())}</p>
                    </div>
                    <div>
                        <label className="account-info-label">Member Since</label>
                        <p className="account-info-value">
                            {currentUser?.metadata?.creationTime
                                ? new Date(currentUser.metadata.creationTime).toLocaleString()
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <label className="account-info-label">Last Login</label>
                        <p className="account-info-value">
                            {currentUser?.metadata?.lastSignInTime
                                ? new Date(currentUser.metadata.lastSignInTime).toLocaleString()
                                : "—"}
                        </p>
                    </div>
                    <div>
                        <label className="account-info-label">Status</label>
                        {currentUser ? (
                            <span className="account-status-active">Active</span>
                        ) : (
                            <span className="account-status-inactive">Signed Out</span>
                        )}
                    </div>
                </div>
            </div>
            {/* Danger Zone Section */}
            <div className="danger-zone">
                <div className="account-user-row">
                    <div className="account-user-name">{userName || currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "User")}</div>
                    <div className="account-user-email">{currentUser?.email || ""}</div>
                </div>
                <button onClick={handleSignout} className="sign-out-button">
                    <span className="sign-out-icon">▷</span>
                    Sign Out
                </button>
            </div>
        </div>
    );
};
export default AccountTab;