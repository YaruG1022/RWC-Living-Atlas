import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import InfoPage from './InfoPage';
import './AccountPage.css';
import './Profile.css';
import api from './api.js';
import Register from './Register';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleUser, faUserFriends, faKey, faTrash } from '@fortawesome/free-solid-svg-icons';
import { faEdit } from '@fortawesome/free-regular-svg-icons';

function Profile(props) {
    const history = useHistory();
    const [showRegister, setShowRegister] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedUsername, setEditedUsername] = useState(props.username || '');
    const [bio, setBio] = useState('');
    const [editedBio, setEditedBio] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');

    const BIO_MAX_LENGTH = 300;

    useEffect(() => {
        const fetchBio = async () => {
            try {
                const res = await api.get('/getBio', { params: { email: props.email } });
                if (res.data.success) {
                    setBio(res.data.bio);
                }
            } catch (err) {
                console.error('Error fetching bio:', err);
            }
        };
        const fetchProfileImage = async () => {
            try {
                const res = await api.get('/getProfileImage', { params: { email: props.email } });
                if (res.data.success) {
              const imageUrl = res.data.profile_image || '';
              setProfileImage(imageUrl);
              if (imageUrl) {
                localStorage.setItem('profileImage', imageUrl);
              } else {
                localStorage.removeItem('profileImage');
              }
              window.dispatchEvent(new CustomEvent('atlas:profile-image-updated', {
                detail: { profileImage: imageUrl }
              }));
                }
            } catch (err) {
                console.error('Error fetching profile image:', err);
            }
        };
        if (props.email) {
            fetchBio();
            fetchProfileImage();
        }
    }, [props.email]);

    const handleEditClick = () => {
        setEditedUsername(props.username);
        setEditedBio(bio);
        setSelectedImageFile(null);
        setImagePreview('');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditedUsername(props.username);
        setEditedBio(bio);
        setSelectedImageFile(null);
        setImagePreview('');
        setIsEditing(false);
    };

    const handleSaveAll = async () => {
        if (!editedUsername.trim()) {
            setMessage('Username cannot be empty.');
            return;
        }
        if (editedBio.length > BIO_MAX_LENGTH) {
            setMessage(`Bio must be ${BIO_MAX_LENGTH} characters or less.`);
            return;
        }
        try {
            const usernameChanged = editedUsername.trim() !== props.username;
            const bioChanged = editedBio !== bio;

            if (usernameChanged) {
                const res = await api.post('/updateUsername', {
                    email: props.email,
                    new_username: editedUsername.trim()
                });
                if (res.data.success) {
                    props.setUsername(res.data.username);
                }
            }
            if (bioChanged) {
                const res = await api.post('/updateBio', {
                    email: props.email,
                    bio: editedBio
                });
                if (res.data.success) {
                    setBio(res.data.bio);
                }
            }
            if (selectedImageFile) {
                const formData = new FormData();
                formData.append('email', props.email);
                formData.append('image', selectedImageFile);
                const res = await api.post('/uploadProfileImage', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.success) {
                  const imageUrl = res.data.profile_image || '';
                  setProfileImage(imageUrl);
                  if (imageUrl) {
                    localStorage.setItem('profileImage', imageUrl);
                  } else {
                    localStorage.removeItem('profileImage');
                  }
                  window.dispatchEvent(new CustomEvent('atlas:profile-image-updated', {
                    detail: { profileImage: imageUrl }
                  }));
                }
            }
            setSelectedImageFile(null);
            setImagePreview('');
            setMessage('Profile updated successfully.');
            setIsEditing(false);
        } catch (err) {
            setMessage('Error updating profile.');
            console.error(err);
        }
    };

    // Password Reset & Change Password States
    const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
    const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
    const [message, setMessage] = useState('');

    // Delete account modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteModalError, setDeleteModalError] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const DELETE_PHRASE = 'confirm deletion';

    const handleOpenDeleteModal = () => {
        setDeleteConfirmText('');
        setDeleteModalError('');
        setShowDeleteModal(true);
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setDeleteConfirmText('');
        setDeleteModalError('');
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText.trim().toLowerCase() !== DELETE_PHRASE) {
            setDeleteModalError(`Please type "${DELETE_PHRASE}" exactly to proceed.`);
            return;
        }
        setIsDeletingAccount(true);
        try {
            await api.delete('/deleteAccount', { data: { email: props.email } });
            if (props.onLogout) props.onLogout();
            history.push('/login');
        } catch (err) {
            setDeleteModalError('Error deleting account. Please try again.');
            console.error(err);
            setIsDeletingAccount(false);
        }
    };

    // Toggle register visibility
    function handleOpenRegister() {
        setShowRegister(true);
    }

    function handleCloseRegister() {
        setShowRegister(false);
    }

    const handleForgotPasswordSubmit = (e) => {
        e.preventDefault();
        api.post('/forgot-password', { email: forgotPasswordEmail })
            .then(response => setMessage('Password recovery email sent.'))
            .catch(error => {
                setMessage('Error sending password recovery email.');
                console.error(error);
            });
    };

    const handleChangePasswordSubmit = (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage('Passwords do not match.');
            return;
        }
        api.post('/reset-password', { email: props.email, new_password: newPassword })
            .then(response => {
                setMessage('Password changed successfully.');
                setNewPassword('');
                setConfirmPassword('');
            })
            .catch(error => {
                setMessage('Error changing password.');
                console.error(error);
            });
    };

    return (
        <InfoPage title="Profile" className="profile-page account-page">

            <div className="profile-edit-bar">
              <div className="profile-edit-bar-text">
                <h2 className="info-page__section-title profile-edit-bar-title">Profile Details</h2>
                <span className="profile-edit-bar-subtitle">Manage your account information, bio, and profile image.</span>
              </div>
              <div className="profile-edit-bar-actions">
                {isEditing ? (
                  <>
                    <button className="account-button" onClick={handleSaveAll}>Save</button>
                    <button className="account-button account-button--secondary" onClick={handleCancelEdit}>Cancel</button>
                  </>
                ) : (
                  <button className="account-button" onClick={handleEditClick}>
                    <FontAwesomeIcon icon={faEdit} /> Edit Profile
                  </button>
                )}
              </div>
            </div>

            <div className="profile-image-section">
              {isEditing ? (
                <label className="profile-avatar-label">
                  {(imagePreview || profileImage) ? (
                    <img
                      src={imagePreview || profileImage}
                      alt="Profile"
                      className="profile-avatar-img"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faCircleUser} className="profile-avatar-icon" />
                  )}
                  <p className="profile-avatar-hint">Click to change</p>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setSelectedImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              ) : (
                profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="profile-avatar-img"
                  />
                ) : (
                  <FontAwesomeIcon icon={faCircleUser} className="profile-avatar-icon" />
                )
              )}
            </div>

            <div className="profile-info-section">
              <div className="profile-info-row">
                <span className="profile-info-label">Username</span>
                {isEditing ? (
                  <input
                    id="profile-username"
                    aria-label="Username"
                    className="account-control profile-field-input"
                    type="text"
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                  />
                ) : (
                  <span className="profile-info-value">{props.username}</span>
                )}
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{props.email}</span>
              </div>
            </div>

            <div className="profile-bio-section">
              <h3 id="profile-bio-heading" className="info-page__subheading">Bio</h3>
              {isEditing ? (
                <>
                  <textarea
                    aria-labelledby="profile-bio-heading"
                    className="account-control profile-bio-textarea"
                    value={editedBio}
                    onChange={(e) => {
                      if (e.target.value.length <= BIO_MAX_LENGTH) {
                        setEditedBio(e.target.value);
                      }
                    }}
                    maxLength={BIO_MAX_LENGTH}
                    rows={4}
                  />
                  <p className="profile-char-count">
                    {editedBio.length}/{BIO_MAX_LENGTH}
                  </p>
                </>
              ) : (
                <p className="profile-bio-text">{bio || 'No bio yet.'}</p>
              )}
            </div>

            <div className="profile-action-row">
              <button className="account-button" onClick={handleOpenRegister}>
                <FontAwesomeIcon icon={faUserFriends} /> Invite New User
              </button>
              <button
                className="account-button account-button--secondary"
                onClick={() => setShowChangePasswordForm(!showChangePasswordForm)}
              >
                <FontAwesomeIcon icon={faKey} /> Change Password
              </button>
            </div>

            {showRegister && <Register closeRegister={handleCloseRegister} />}

            {showForgotPasswordForm && (
              <form className="account-panel profile-form" onSubmit={handleForgotPasswordSubmit}>
                <div className="profile-form-field">
                  <label className="profile-form-label" htmlFor="profile-reset-email">Email for password reset</label>
                  <input
                    className="account-control"
                    id="profile-reset-email"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                  />
                </div>
                <button className="account-button" type="submit">Submit</button>
              </form>
            )}

            {showChangePasswordForm && (
              <form className="account-panel profile-form" onSubmit={handleChangePasswordSubmit}>
                <div className="profile-form-field">
                  <label className="profile-form-label" htmlFor="profile-new-password">New Password</label>
                  <input
                    className="account-control"
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="profile-form-field">
                  <label className="profile-form-label" htmlFor="profile-confirm-password">Confirm New Password</label>
                  <input
                    className="account-control"
                    id="profile-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <button className="account-button" type="submit">Change Password</button>
              </form>
            )}

            {message && <p className="profile-message" role="status">{message}</p>}

            {/* Delete account section */}
            <div className="account-panel profile-danger-zone">
              <div className="profile-danger-zone-header">
                <h2 className="profile-danger-zone-title">Danger Zone</h2>
                <span className="profile-danger-zone-desc">Permanently delete your account and all associated data.</span>
              </div>
              <button
                className="account-button account-button--danger"
                onClick={handleOpenDeleteModal}
              >
                <FontAwesomeIcon icon={faTrash} /> Delete Account
              </button>
            </div>

            {/* Delete account modal */}
            {showDeleteModal && (
              <div className="profile-delete-modal-overlay" onClick={handleCloseDeleteModal}>
                <div className="account-panel profile-delete-modal" role="dialog" aria-modal="true" aria-labelledby="profile-delete-modal-title" onClick={(e) => e.stopPropagation()}>
                  <h2 id="profile-delete-modal-title" className="profile-delete-modal-title">Delete Account</h2>
                  <p className="profile-delete-modal-subtitle">
                    This will permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
                  </p>
                  <label className="profile-delete-modal-label" htmlFor="profile-delete-confirm-input">
                    Type <strong>{DELETE_PHRASE}</strong> to confirm
                  </label>
                  <input
                    id="profile-delete-confirm-input"
                    className="account-control"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteModalError(''); }}
                    placeholder={DELETE_PHRASE}
                    autoFocus
                  />
                  {deleteModalError && (
                    <p className="profile-delete-modal-error" role="alert">{deleteModalError}</p>
                  )}
                  <div className="profile-delete-modal-actions">
                    <button className="account-button account-button--secondary" onClick={handleCloseDeleteModal}>
                      Cancel
                    </button>
                    <button
                      className="account-button account-button--danger"
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </InfoPage>
        );
}

export default Profile;